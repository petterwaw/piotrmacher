import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'

export type PickemEvent = {
  id: string
  provider: string | null
  provider_event_id: string | null
  season: string | null
}

export type PickemTeam = {
  teamId: string
  name: string
  logo: string | null
  currentPosition: number | null
}

export type PickemGroup = {
  groupKey: string
  groupName: string
  teams: PickemTeam[]
}

type PickemGroupTeamRow = {
  group_key: string
  group_name: string
  group_order: number | null
  provider_team_id: string
  team_name: string
  team_logo: string | null
  current_position: number | null
  last_synced_at: string | null
}

type ApiFootballStandingRow = {
  rank?: number | string | null
  group?: string | null
  team?: {
    id?: number | string | null
    name?: string | null
    logo?: string | null
  } | null
}

const PICKEM_GROUP_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000

function groupKeyFromName(groupName: string, fallbackIndex: number) {
  const key = groupName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return key || `group-${fallbackIndex + 1}`
}

function parsePosition(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function rowsToGroups(rows: PickemGroupTeamRow[]): PickemGroup[] {
  const grouped = new Map<string, { groupName: string; groupOrder: number; teams: PickemTeam[] }>()

  for (const row of rows) {
    const current = grouped.get(row.group_key) ?? {
      groupName: row.group_name,
      groupOrder: row.group_order ?? 0,
      teams: [],
    }

    current.teams.push({
      teamId: row.provider_team_id,
      name: row.team_name,
      logo: row.team_logo,
      currentPosition: row.current_position,
    })

    grouped.set(row.group_key, current)
  }

  return [...grouped.entries()]
    .sort(([, a], [, b]) => a.groupOrder - b.groupOrder || a.groupName.localeCompare(b.groupName))
    .map(([groupKey, group]) => ({
      groupKey,
      groupName: group.groupName,
      teams: group.teams.sort((a, b) => {
        const aPos = a.currentPosition ?? Number.MAX_SAFE_INTEGER
        const bPos = b.currentPosition ?? Number.MAX_SAFE_INTEGER
        return aPos - bPos || a.name.localeCompare(b.name)
      }),
    }))
}

function parseApiFootballStandings(body: unknown, eventId: string) {
  const response = (body as { response?: unknown })?.response
  const first = Array.isArray(response) ? response[0] : null
  const standings = (first as { league?: { standings?: unknown } } | null)?.league?.standings

  if (!Array.isArray(standings)) {
    return []
  }

  const nowIso = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []

  standings.forEach((groupRows, groupIndex) => {
    if (!Array.isArray(groupRows)) {
      return
    }

    groupRows.forEach((standing, teamIndex) => {
      const row = standing as ApiFootballStandingRow
      const teamId = row.team?.id === undefined || row.team?.id === null ? '' : String(row.team.id)
      const teamName = row.team?.name?.trim()

      if (!teamId || !teamName) {
        return
      }

      const groupName = row.group?.trim() || `Group ${groupIndex + 1}`
      const groupKey = groupKeyFromName(groupName, groupIndex)
      const position = parsePosition(row.rank, teamIndex + 1)

      rows.push({
        event_id: eventId,
        group_key: groupKey,
        group_name: groupName,
        group_order: groupIndex,
        provider_team_id: teamId,
        team_name: teamName,
        team_logo: row.team?.logo ?? null,
        initial_position: position,
        current_position: position,
        last_synced_at: nowIso,
        updated_at: nowIso,
      })
    })
  })

  return rows
}

async function loadCachedGroups(eventId: string) {
  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from('pickem_group_teams')
    .select('group_key, group_name, group_order, provider_team_id, team_name, team_logo, current_position, last_synced_at')
    .eq('event_id', eventId)
    .order('group_order', { ascending: true })
    .order('current_position', { ascending: true })
    .order('team_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PickemGroupTeamRow[]
}

function isCacheFresh(rows: PickemGroupTeamRow[]) {
  const latestSync = rows
    .map((row) => row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0)
    .reduce((latest, value) => Math.max(latest, Number.isFinite(value) ? value : 0), 0)

  return latestSync > 0 && Date.now() - latestSync < PICKEM_GROUP_SYNC_INTERVAL_MS
}

export async function syncPickemGroupsForEvent(
  event: PickemEvent,
  options: { force?: boolean } = {}
): Promise<{ groups: PickemGroup[]; error: string | null; synced: boolean }> {
  let cachedRows: PickemGroupTeamRow[] = []

  try {
    cachedRows = await loadCachedGroups(event.id)
  } catch (error) {
    return {
      groups: [],
      error: error instanceof Error
        ? `Pickem database tables are not ready: ${error.message}`
        : 'Pickem database tables are not ready.',
      synced: false,
    }
  }

  const canFetchFromProvider =
    event.provider === 'api-football' &&
    Boolean(event.provider_event_id) &&
    Boolean(event.season) &&
    Boolean(process.env.FOOTBALL_API_KEY)

  const shouldSync = canFetchFromProvider && (options.force || cachedRows.length === 0 || !isCacheFresh(cachedRows))

  if (!shouldSync) {
    const missingReason = cachedRows.length === 0 && !canFetchFromProvider
      ? 'No cached Pickem groups yet. Check event provider data and FOOTBALL_API_KEY.'
      : null

    return {
      groups: rowsToGroups(cachedRows),
      error: missingReason,
      synced: false,
    }
  }

  const apiHost = process.env.FOOTBALL_API_HOST || 'v3.football.api-sports.io'
  const url = new URL(`https://${apiHost}/standings`)
  url.searchParams.set('league', String(event.provider_event_id))
  url.searchParams.set('season', String(event.season))

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': apiHost,
        'x-rapidapi-key': process.env.FOOTBALL_API_KEY!,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        groups: rowsToGroups(cachedRows),
        error: cachedRows.length > 0 ? null : `Could not load groups from API-Football (${response.status}).`,
        synced: false,
      }
    }

    const body = await response.json()
    const rows = parseApiFootballStandings(body, event.id)

    if (rows.length === 0) {
      return {
        groups: rowsToGroups(cachedRows),
        error: cachedRows.length > 0 ? null : 'API-Football did not return group standings for this event yet.',
        synced: false,
      }
    }

    const supabase = createServiceRoleSupabaseClient()
    const { error: upsertError } = await supabase
      .from('pickem_group_teams')
      .upsert(rows, { onConflict: 'event_id,group_key,provider_team_id' })

    if (upsertError) {
      return {
        groups: rowsToGroups(cachedRows),
        error: cachedRows.length > 0 ? null : `Could not cache Pickem groups: ${upsertError.message}`,
        synced: false,
      }
    }

    const freshRows = await loadCachedGroups(event.id)

    return {
      groups: rowsToGroups(freshRows),
      error: null,
      synced: true,
    }
  } catch {
    return {
      groups: rowsToGroups(cachedRows),
      error: cachedRows.length > 0 ? null : 'Could not load groups from API-Football.',
      synced: false,
    }
  }
}

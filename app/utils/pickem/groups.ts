import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { ESPN_PROVIDER, fetchEspnStandings } from '@/app/utils/providers/espn'

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

const PICKEM_GROUP_SYNC_INTERVAL_MS = 60 * 60 * 1000

function isThirdPlaceGroup(groupName: string, groupKey: string): boolean {
  const name = groupName.toLowerCase()
  const key = groupKey.toLowerCase()
  return (
    name.includes('3rd') ||
    name.includes('third') ||
    key.includes('3rd') ||
    key.includes('third')
  )
}

function groupKeyFromName(groupName: string, fallbackIndex: number) {
  const key = groupName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return key || `group-${fallbackIndex + 1}`
}

function rowsToGroups(rows: PickemGroupTeamRow[]): PickemGroup[] {
  const grouped = new Map<string, { groupName: string; groupOrder: number; teams: PickemTeam[] }>()

  for (const row of rows) {
    if (isThirdPlaceGroup(row.group_name, row.group_key)) continue

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

async function fetchStandingRows(leagueSlug: string, eventId: string) {
  const standings = await fetchEspnStandings(leagueSlug)
  const nowIso = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []

  for (const standing of standings) {
    const groupKey = groupKeyFromName(standing.groupName, standing.groupOrder)
    if (isThirdPlaceGroup(standing.groupName, groupKey)) continue

    rows.push({
      event_id: eventId,
      group_key: groupKey,
      group_name: standing.groupName,
      group_order: standing.groupOrder,
      provider_team_id: standing.teamId,
      team_name: standing.teamName,
      team_logo: standing.teamLogo,
      current_position: standing.position,
      last_synced_at: nowIso,
      updated_at: nowIso,
    })
  }

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

  const canFetchFromProvider = event.provider === ESPN_PROVIDER && Boolean(event.provider_event_id)

  const shouldSync = canFetchFromProvider && (options.force || cachedRows.length === 0 || !isCacheFresh(cachedRows))

  if (!shouldSync) {
    const missingReason = cachedRows.length === 0 && !canFetchFromProvider
      ? 'No cached Pickem groups yet. Check the event provider data.'
      : null

    return {
      groups: rowsToGroups(cachedRows),
      error: missingReason,
      synced: false,
    }
  }

  try {
    const rows = await fetchStandingRows(String(event.provider_event_id), event.id)

    if (rows.length === 0) {
      return {
        groups: rowsToGroups(cachedRows),
        error: cachedRows.length > 0 ? null : 'The provider did not return group standings for this event yet.',
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
      error: cachedRows.length > 0 ? null : 'Could not load groups from the provider.',
      synced: false,
    }
  }
}

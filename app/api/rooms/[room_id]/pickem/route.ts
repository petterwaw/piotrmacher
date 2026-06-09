import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { isWorldCupPickemEvent } from '@/app/utils/pickem/eligibility'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

type PickemPayload = {
  groups?: Array<{
    groupKey?: string
    orderedTeamIds?: unknown
  }>
}

type GroupTeamRow = {
  group_key: string
  provider_team_id: string
}

type MatchStartRow = {
  scheduled_start_at: string
}

type EventRelation = {
  name: string | null
  provider_event_id: string | null
} | Array<{
  name: string | null
  provider_event_id: string | null
}> | null

type RoomRow = {
  id: string
  host_id: string
  event_id: string
  status: string
  events: EventRelation
}

const MAX_PICKEM_GROUPS = 16
const MAX_TEAMS_PER_GROUP = 12

function normalizeTeamIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TEAMS_PER_GROUP) {
    return null
  }

  const ids = value
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)

  if (ids.length !== value.length || new Set(ids).size !== ids.length) {
    return null
  }

  return ids
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const lookup = new Set(a)
  return b.every((value) => lookup.has(value))
}

function pickOne<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function isThirdPlaceGroupKey(key: string): boolean {
  return key.includes('3rd') || key.includes('third')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id, event_id, status, events(name, provider_event_id)')
      .eq('id', room_id)
      .maybeSingle()

    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    }

    const typedRoom = room as RoomRow
    const event = pickOne(typedRoom.events)

    if (!isWorldCupPickemEvent(event)) {
      return NextResponse.json({ error: 'Pickem is available only for World Cup events.' }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership && typedRoom.host_id !== user.id) {
      return NextResponse.json({ error: 'You are not a member of this room.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as PickemPayload | null
    const groups = body?.groups

    if (!Array.isArray(groups) || groups.length === 0 || groups.length > MAX_PICKEM_GROUPS) {
      return NextResponse.json({ error: 'Invalid Pickem payload.' }, { status: 400 })
    }

    const serviceSupabase = createServiceRoleSupabaseClient()
    const { data: firstMatch } = await serviceSupabase
      .from('matches')
      .select('scheduled_start_at')
      .eq('event_id', typedRoom.event_id)
      .order('scheduled_start_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstMatch && Date.now() >= new Date((firstMatch as MatchStartRow).scheduled_start_at).getTime()) {
      return NextResponse.json({ error: 'Pickem is locked after the first event match starts.' }, { status: 400 })
    }

    const { data: groupTeams, error: groupTeamsError } = await serviceSupabase
      .from('pickem_group_teams')
      .select('group_key, provider_team_id')
      .eq('event_id', typedRoom.event_id)

    if (groupTeamsError) {
      return NextResponse.json({ error: 'Pickem tables are not ready.' }, { status: 500 })
    }

    const expectedTeamIdsByGroup = new Map<string, string[]>()
    for (const row of (groupTeams ?? []) as GroupTeamRow[]) {
      const current = expectedTeamIdsByGroup.get(row.group_key) ?? []
      current.push(row.provider_team_id)
      expectedTeamIdsByGroup.set(row.group_key, current)
    }

    if (expectedTeamIdsByGroup.size === 0) {
      return NextResponse.json({ error: 'Pickem groups are not loaded yet.' }, { status: 400 })
    }

    const submittedGroupKeys = new Set<string>()
    const rows = []
    const nowIso = new Date().toISOString()

    for (const group of groups) {
      const groupKey = typeof group.groupKey === 'string' ? group.groupKey.trim() : ''
      const orderedTeamIds = normalizeTeamIds(group.orderedTeamIds)

      let expectedTeamIds: string[] | undefined

      if (isThirdPlaceGroupKey(groupKey)) {
        expectedTeamIds = groups
          .filter(g => typeof g.groupKey === 'string' && !isThirdPlaceGroupKey(g.groupKey.trim()))
          .map(g => normalizeTeamIds(g.orderedTeamIds)?.[2])
          .filter((id): id is string => Boolean(id))
      } else {
        expectedTeamIds = expectedTeamIdsByGroup.get(groupKey)
      }

      if (!groupKey || !orderedTeamIds || !expectedTeamIds || !sameSet(orderedTeamIds, expectedTeamIds)) {
        return NextResponse.json({ error: 'Invalid team order.' }, { status: 400 })
      }

      submittedGroupKeys.add(groupKey)
      rows.push({
        room_id,
        user_id: user.id,
        event_id: typedRoom.event_id,
        group_key: groupKey,
        ordered_team_ids: orderedTeamIds,
        points: 0,
        scored_at: null,
        updated_at: nowIso,
      })
    }

    if (submittedGroupKeys.size !== expectedTeamIdsByGroup.size) {
      return NextResponse.json({ error: 'Submit every Pickem group before saving.' }, { status: 400 })
    }

    const { error: saveError } = await serviceSupabase
      .from('pickem_group_picks')
      .upsert(rows, { onConflict: 'room_id,user_id,event_id,group_key' })

    if (saveError) {
      return NextResponse.json({ error: 'Could not save Pickem.' }, { status: 500 })
    }

    revalidatePath(`/home/${room_id}/pickem`)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

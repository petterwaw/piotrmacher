import type { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { isWorldCupPickemEvent } from '@/app/utils/pickem/eligibility'
import { syncPickemGroupsForEvent, type PickemEvent } from '@/app/utils/pickem/groups'
import { recomputeRoomPoints } from '@/app/utils/scoring/processPendingScoringJobs'

type ServiceSupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>

export type PickemScoringResult =
  | { ok: true; roomsChecked: number; picksUpdated: number; roomPlayersUpdated: number; scoringStatusByEvent?: Record<string, unknown> }
  | { ok: false; error: string }

type Rules = {
  pickem_correct_position?: number
}

type RoomRow = {
  id: string
  event_id: string
  status: string
  rules: Rules | null
}

type EventRow = {
  id: string
  name: string | null
  provider: string | null
  provider_event_id: string | null
  season: string | null
}

type PickRow = {
  id: string
  room_id: string
  user_id: string
  event_id: string
  group_key: string
  ordered_team_ids: string[] | null
  points: number | null
}

type GroupTeamRow = {
  event_id: string
  group_key: string
  provider_team_id: string
  current_position: number | null
}

type MatchStatusRow = {
  event_id: string
}

const FIFA_WORLD_CUP_2026_GROUP_MATCHES = 72

function parsePositiveInteger(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function calculateRoundRobinMatchCount(groupSizes: Iterable<number>) {
  let requiredMatches = 0

  for (const teamCount of groupSizes) {
    if (teamCount > 1) {
      requiredMatches += (teamCount * (teamCount - 1)) / 2
    }
  }

  return requiredMatches
}

function expectedFinishedGroupMatches(event: EventRow | undefined, groupSizes: Iterable<number>) {
  const override = parsePositiveInteger(process.env.PICKEM_GROUP_STAGE_FINISHED_MATCHES)
  if (override) return override

  if (
    event?.provider_event_id === '1' &&
    event.season === '2026' &&
    isWorldCupPickemEvent(event)
  ) {
    return FIFA_WORLD_CUP_2026_GROUP_MATCHES
  }

  return calculateRoundRobinMatchCount(groupSizes)
}

function toRuleScore(rules: Rules | null | undefined) {
  const parsed = Number(rules?.pickem_correct_position)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

function calculatePickemPoints(
  orderedTeamIds: string[],
  positionByTeamId: Map<string, number>,
  pointsPerCorrectPosition: number
) {
  if (pointsPerCorrectPosition <= 0) return 0

  return orderedTeamIds.reduce((points, teamId, index) => {
    const officialPosition = positionByTeamId.get(teamId)
    return officialPosition === index + 1 ? points + pointsPerCorrectPosition : points
  }, 0)
}

// Only active rooms are scored: finished rooms keep their final standings even
// if provider data (e.g. team ids after a provider switch) changes later.
export async function scorePickem(supabase: ServiceSupabaseClient): Promise<PickemScoringResult> {
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, event_id, status, rules')
    .eq('status', 'active')

  if (roomsError) {
    return { ok: false, error: 'Could not load rooms.' }
  }

  const activeRooms = (rooms ?? []) as RoomRow[]
  if (activeRooms.length === 0) {
    return { ok: true, roomsChecked: 0, picksUpdated: 0, roomPlayersUpdated: 0 }
  }

  const eventIds = [...new Set(activeRooms.map((room) => room.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('id, name, provider, provider_event_id, season')
    .in('id', eventIds)

  const scoringEvents = ((events ?? []) as EventRow[])
    .filter((event) => isWorldCupPickemEvent(event))

  if (scoringEvents.length === 0) {
    return { ok: true, roomsChecked: 0, picksUpdated: 0, roomPlayersUpdated: 0 }
  }

  const scoringEventIdSet = new Set(scoringEvents.map((event) => event.id))
  const scoringEventById = new Map(scoringEvents.map((event) => [event.id, event]))
  const scoringRooms = activeRooms.filter((room) => scoringEventIdSet.has(room.event_id))

  if (scoringRooms.length === 0) {
    return { ok: true, roomsChecked: 0, picksUpdated: 0, roomPlayersUpdated: 0 }
  }

  for (const event of scoringEvents) {
    await syncPickemGroupsForEvent(event as PickemEvent)
  }

  const roomById = new Map(scoringRooms.map((room) => [room.id, room]))
  const roomIds = scoringRooms.map((room) => room.id)

  const { data: picks, error: picksError } = await supabase
    .from('pickem_group_picks')
    .select('id, room_id, user_id, event_id, group_key, ordered_team_ids, points')
    .in('room_id', roomIds)

  if (picksError) {
    return { ok: false, error: 'Could not load Pickem picks.' }
  }

  const pickRows = (picks ?? []) as PickRow[]
  if (pickRows.length === 0) {
    return { ok: true, roomsChecked: scoringRooms.length, picksUpdated: 0, roomPlayersUpdated: 0 }
  }

  const pickEventIds = [...new Set(pickRows.map((pick) => pick.event_id))]
  const { data: groupTeams, error: groupTeamsError } = await supabase
    .from('pickem_group_teams')
    .select('event_id, group_key, provider_team_id, current_position')
    .in('event_id', pickEventIds)

  if (groupTeamsError) {
    return { ok: false, error: 'Could not load Pickem group standings.' }
  }

  const teamsPerGroupByEvent = new Map<string, Map<string, number>>()
  for (const team of (groupTeams ?? []) as GroupTeamRow[]) {
    const byGroup = teamsPerGroupByEvent.get(team.event_id) ?? new Map<string, number>()
    byGroup.set(team.group_key, (byGroup.get(team.group_key) ?? 0) + 1)
    teamsPerGroupByEvent.set(team.event_id, byGroup)
  }

  const requiredGroupMatchesByEvent = new Map<string, number>()
  for (const [eventId, byGroup] of teamsPerGroupByEvent.entries()) {
    requiredGroupMatchesByEvent.set(
      eventId,
      expectedFinishedGroupMatches(scoringEventById.get(eventId), byGroup.values()),
    )
  }

  const { data: finishedMatches, error: finishedMatchesError } = await supabase
    .from('matches')
    .select('event_id')
    .in('event_id', pickEventIds)
    .eq('status', 'finished')

  if (finishedMatchesError) {
    return { ok: false, error: 'Could not load match status for Pickem scoring.' }
  }

  const finishedMatchCountByEvent = new Map<string, number>()
  for (const match of (finishedMatches ?? []) as MatchStatusRow[]) {
    finishedMatchCountByEvent.set(
      match.event_id,
      (finishedMatchCountByEvent.get(match.event_id) ?? 0) + 1,
    )
  }

  const scoringOpenByEvent = new Map<string, boolean>()
  const scoringStatusByEvent: Record<string, {
    requiredFinishedGroupMatches: number
    finishedMatches: number
    open: boolean
  }> = {}
  for (const eventId of pickEventIds) {
    const required = requiredGroupMatchesByEvent.get(eventId) ?? 0
    const finished = finishedMatchCountByEvent.get(eventId) ?? 0
    const open = required > 0 && finished >= required
    scoringOpenByEvent.set(eventId, open)
    scoringStatusByEvent[eventId] = {
      requiredFinishedGroupMatches: required,
      finishedMatches: finished,
      open,
    }
  }

  const positionsByEventGroup = new Map<string, Map<string, number>>()
  for (const team of (groupTeams ?? []) as GroupTeamRow[]) {
    if (!team.current_position) continue
    const key = `${team.event_id}:${team.group_key}`
    const current = positionsByEventGroup.get(key) ?? new Map<string, number>()
    current.set(team.provider_team_id, team.current_position)
    positionsByEventGroup.set(key, current)
  }

  const pickUpdates: Array<{ id: string; points: number }> = []
  const affectedRoomIds = new Set<string>()

  for (const pick of pickRows) {
    const room = roomById.get(pick.room_id)
    if (!room || room.event_id !== pick.event_id) continue
    if (!scoringOpenByEvent.get(pick.event_id)) continue

    const positionByTeamId = positionsByEventGroup.get(`${pick.event_id}:${pick.group_key}`)
    const orderedTeamIds = pick.ordered_team_ids ?? []
    if (!positionByTeamId || orderedTeamIds.length === 0) continue

    const nextPoints = calculatePickemPoints(
      orderedTeamIds,
      positionByTeamId,
      toRuleScore(room.rules),
    )
    if (pick.points !== nextPoints) {
      pickUpdates.push({ id: pick.id, points: nextPoints })
      affectedRoomIds.add(pick.room_id)
    }
  }

  const nowIso = new Date().toISOString()
  for (const update of pickUpdates) {
    const { error: updateError } = await supabase
      .from('pickem_group_picks')
      .update({
        points: update.points,
        scored_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', update.id)

    if (updateError) {
      return { ok: false, error: 'Could not update Pickem points.' }
    }
  }

  const recomputeError = await recomputeRoomPoints(supabase, [...affectedRoomIds])
  if (recomputeError) {
    return { ok: false, error: 'Could not recompute room points.' }
  }

  return {
    ok: true,
    roomsChecked: scoringRooms.length,
    picksUpdated: pickUpdates.length,
    roomPlayersUpdated: affectedRoomIds.size,
    scoringStatusByEvent,
  }
}

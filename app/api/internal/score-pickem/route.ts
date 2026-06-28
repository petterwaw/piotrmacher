import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { isWorldCupPickemEvent } from '@/app/utils/pickem/eligibility'
import { syncPickemGroupsForEvent, type PickemEvent } from '@/app/utils/pickem/groups'
import { NextRequest, NextResponse } from 'next/server'

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

async function processPickemScoring(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, event_id, status, rules')
    .in('status', ['active', 'finished'])

  if (roomsError) {
    return NextResponse.json({ error: 'Could not load rooms.' }, { status: 500 })
  }

  const activeRooms = (rooms ?? []) as RoomRow[]
  if (activeRooms.length === 0) {
    return NextResponse.json({ ok: true, roomsChecked: 0, picksUpdated: 0, roomPlayersUpdated: 0 })
  }

  const eventIds = [...new Set(activeRooms.map((room) => room.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('id, name, provider, provider_event_id, season')
    .in('id', eventIds)

  const scoringEvents = ((events ?? []) as EventRow[])
    .filter((event) => isWorldCupPickemEvent(event))

  if (scoringEvents.length === 0) {
    return NextResponse.json({ ok: true, roomsChecked: 0, picksUpdated: 0, roomPlayersUpdated: 0 })
  }

  const scoringEventIdSet = new Set(scoringEvents.map((event) => event.id))
  const scoringEventById = new Map(scoringEvents.map((event) => [event.id, event]))
  const scoringRooms = activeRooms.filter((room) => scoringEventIdSet.has(room.event_id))

  if (scoringRooms.length === 0) {
    return NextResponse.json({ ok: true, roomsChecked: 0, picksUpdated: 0, roomPlayersUpdated: 0 })
  }

  for (const event of scoringEvents) {
    await syncPickemGroupsForEvent(event as PickemEvent, { force: true })
  }

  const roomById = new Map(scoringRooms.map((room) => [room.id, room]))
  const roomIds = scoringRooms.map((room) => room.id)

  const { data: picks, error: picksError } = await supabase
    .from('pickem_group_picks')
    .select('id, room_id, user_id, event_id, group_key, ordered_team_ids, points')
    .in('room_id', roomIds)

  if (picksError) {
    return NextResponse.json({ error: 'Could not load Pickem picks.' }, { status: 500 })
  }

  const pickRows = (picks ?? []) as PickRow[]
  if (pickRows.length === 0) {
    return NextResponse.json({ ok: true, roomsChecked: scoringRooms.length, picksUpdated: 0, roomPlayersUpdated: 0 })
  }

  const pickEventIds = [...new Set(pickRows.map((pick) => pick.event_id))]
  const { data: groupTeams, error: groupTeamsError } = await supabase
    .from('pickem_group_teams')
    .select('event_id, group_key, provider_team_id, current_position')
    .in('event_id', pickEventIds)

  if (groupTeamsError) {
    return NextResponse.json({ error: 'Could not load Pickem group standings.' }, { status: 500 })
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
    return NextResponse.json({ error: 'Could not load match status for Pickem scoring.' }, { status: 500 })
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
  const roomUserDelta = new Map<string, { roomId: string; userId: string; delta: number }>()

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
    const oldPoints = pick.points ?? 0
    const delta = nextPoints - oldPoints

    if (delta !== 0 || pick.points === null) {
      pickUpdates.push({ id: pick.id, points: nextPoints })
    }

    if (delta !== 0) {
      const key = `${pick.room_id}:${pick.user_id}`
      const current = roomUserDelta.get(key)
      if (current) {
        current.delta += delta
      } else {
        roomUserDelta.set(key, {
          roomId: pick.room_id,
          userId: pick.user_id,
          delta,
        })
      }
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
      return NextResponse.json({ error: 'Could not update Pickem points.' }, { status: 500 })
    }
  }

  const deltaEntries = [...roomUserDelta.values()]
  if (deltaEntries.length > 0) {
    const deltaRoomIds = [...new Set(deltaEntries.map((entry) => entry.roomId))]
    const deltaUserIds = [...new Set(deltaEntries.map((entry) => entry.userId))]

    const { data: roomPlayers, error: roomPlayersError } = await supabase
      .from('room_players')
      .select('id, room_id, user_id, points')
      .in('room_id', deltaRoomIds)
      .in('user_id', deltaUserIds)

    if (roomPlayersError) {
      return NextResponse.json({ error: 'Could not load room players.' }, { status: 500 })
    }

    const playerByKey = new Map((roomPlayers ?? []).map((row) => [`${row.room_id}:${row.user_id}`, row]))

    for (const entry of deltaEntries) {
      const player = playerByKey.get(`${entry.roomId}:${entry.userId}`)
      if (!player) continue

      const { error: playerUpdateError } = await supabase
        .from('room_players')
        .update({ points: player.points + entry.delta })
        .eq('id', player.id)

      if (playerUpdateError) {
        return NextResponse.json({ error: 'Could not update room player points.' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    roomsChecked: scoringRooms.length,
    picksUpdated: pickUpdates.length,
    roomPlayersUpdated: deltaEntries.length,
    scoringStatusByEvent,
  })
}

export async function GET(request: NextRequest) {
  return processPickemScoring(request)
}

export async function POST(request: NextRequest) {
  return processPickemScoring(request)
}

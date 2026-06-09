import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { isWorldCupPickemEvent } from '@/app/utils/pickem/eligibility'
import { syncPickemGroupsForEvent, type PickemEvent } from '@/app/utils/pickem/groups'
import PickemPanel from './PickemPanel'

type Rules = {
  pickem_correct_position?: number
}

type EventRelation = {
  provider: string | null
  provider_event_id: string | null
  season: string | null
  name: string | null
} | Array<{
  provider: string | null
  provider_event_id: string | null
  season: string | null
  name: string | null
}> | null

type RoomRow = {
  id: string
  host_id: string
  status: string
  event_id: string
  rules: Rules | null
  events: EventRelation
}

type PickemPickRow = {
  group_key: string
  ordered_team_ids: string[] | null
  points: number | null
  scored_at: string | null
}

type MatchStartRow = {
  scheduled_start_at: string
}

function pickOne<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function toRuleScore(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1
}

export default async function PickemPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: room } = await supabase
    .from('rooms')
    .select('id, host_id, status, event_id, rules, events(provider, provider_event_id, season, name)')
    .eq('id', room_id)
    .maybeSingle()

  if (!room) {
    return <p className="text-text-muted">Room not found.</p>
  }

  if (!user) {
    return <p className="text-text-muted">Sign in to set your Pickem.</p>
  }

  const typedRoom = room as RoomRow
  const { data: membership } = await supabase
    .from('room_players')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership && typedRoom.host_id !== user.id) {
    return <p className="text-text-muted">Join this room to play Pickem.</p>
  }

  const event = pickOne(typedRoom.events)

  if (!event) {
    return <p className="text-text-muted">This room has no event configured.</p>
  }

  if (!isWorldCupPickemEvent(event)) {
    return <p className="text-text-muted">Pickem is available only for World Cup events.</p>
  }

  const { data: firstMatch } = await supabase
    .from('matches')
    .select('scheduled_start_at')
    .eq('event_id', typedRoom.event_id)
    .order('scheduled_start_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const canEditBeforeKickoff =
    !firstMatch || Date.now() < new Date((firstMatch as MatchStartRow).scheduled_start_at).getTime()

  const pickemEvent: PickemEvent = {
    id: typedRoom.event_id,
    provider: event.provider,
    provider_event_id: event.provider_event_id,
    season: event.season,
  }
  const { groups, error } = await syncPickemGroupsForEvent(pickemEvent)

  if (groups.length === 0) {
    return (
      <div className="border-2 border-zinc-300 bg-white p-6">
        <h1 className="text-2xl font-black text-text-main">Pickem</h1>
        <p className="mt-2 text-sm text-text-muted">
          {error ?? 'No group standings are available for this event yet.'}
        </p>
      </div>
    )
  }

  const { data: pickRows } = await supabase
    .from('pickem_group_picks')
    .select('group_key, ordered_team_ids, points, scored_at')
    .eq('room_id', room_id)
    .eq('event_id', typedRoom.event_id)
    .eq('user_id', user.id)

  const initialPicks = ((pickRows ?? []) as PickemPickRow[]).reduce<Record<string, {
    orderedTeamIds: string[]
    points: number
    scoredAt: string | null
  }>>((acc, pick) => {
    acc[pick.group_key] = {
      orderedTeamIds: pick.ordered_team_ids ?? [],
      points: pick.points ?? 0,
      scoredAt: pick.scored_at,
    }
    return acc
  }, {})

  return (
    <PickemPanel
      roomId={room_id}
      groups={groups}
      initialPicks={initialPicks}
      canEdit={canEditBeforeKickoff}
      pointsPerCorrectPosition={toRuleScore(typedRoom.rules?.pickem_correct_position)}
    />
  )
}

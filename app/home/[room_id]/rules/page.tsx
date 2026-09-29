import { getCachedRoomRules } from '@/app/utils/cache/roomReads'
import { requireRoomAccess } from '@/app/utils/rooms/requireRoomAccess'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { isWorldCupPickemEvent } from '@/app/utils/pickem/eligibility'
import RulesContent, { type RoomRules } from './RulesContent'

type EventRelation =
  | { name: string | null; provider_event_id: string | null }
  | Array<{ name: string | null; provider_event_id: string | null }>
  | null

const defaultRules: RoomRules = {
  correct_winner: 1,
  correct_draw: 1,
  correct_difference: 1,
  correct_away_goals: 1,
  correct_home_goals: 1,
  exact_score: 1,
  exact_draw: 1,
  pickem_correct_position: 1,
}

export default async function RulesPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  await requireRoomAccess(room_id)

  const supabase = await createServerSupabaseClient()
  const [cachedRules, { data: room }] = await Promise.all([
    getCachedRoomRules(room_id),
    supabase.from('rooms').select('events(name, provider_event_id)').eq('id', room_id).maybeSingle(),
  ])

  const rules = {
    ...defaultRules,
    ...(cachedRules ?? {}),
  }

  const eventRelation = room?.events as EventRelation | undefined
  const eventRow = Array.isArray(eventRelation) ? eventRelation[0] : eventRelation

  return <RulesContent rules={rules} showPickem={isWorldCupPickemEvent(eventRow)} />
}

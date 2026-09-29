import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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

export const metadata: Metadata = { title: 'Rules' }

export default async function RulesPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params

  // One RLS-scoped read: it is both the access check and the data (the room
  // row is needed for the event anyway, so a shared cache would save nothing).
  const supabase = await createServerSupabaseClient()
  const { data: room } = await supabase
    .from('rooms')
    .select('rules, events(name, provider_event_id)')
    .eq('id', room_id)
    .maybeSingle()

  if (!room) {
    notFound()
  }

  const rules = {
    ...defaultRules,
    ...((room.rules as Partial<RoomRules> | null) ?? {}),
  }

  const eventRelation = room.events as EventRelation | undefined
  const eventRow = Array.isArray(eventRelation) ? eventRelation[0] : eventRelation

  return <RulesContent rules={rules} showPickem={isWorldCupPickemEvent(eventRow)} />
}

import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { getActiveEvents } from '@/app/utils/events/getActiveEvents'
import { redirect } from 'next/navigation'
import SettingsPanel from './SettingsPanel'

type Rules = {
  correct_winner: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

export default async function RoomSettingsPage({
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
    .select('id, host_id, status, event_id, invite_code, rules, room_end_at')
    .eq('id', room_id)
    .maybeSingle()

  if (!room) {
    return <p className="text-text-muted">Room not found.</p>
  }

  if (!user || room.host_id !== user.id) {
    return <p className="text-text-muted">Only host can access settings.</p>
  }

  if (room.status !== 'waiting') {
    redirect(`/home/${room_id}`)
  }

  const events = await getActiveEvents()

  const rules = room.rules as Rules

  return (
    <SettingsPanel
      roomId={room_id}
      initialStatus={room.status as 'waiting' | 'active' | 'finished'}
      initialEventId={room.event_id}
      initialRoomEndAt={room.room_end_at}
      inviteCode={room.invite_code}
      events={events}
      initialRules={rules}
    />
  )
}
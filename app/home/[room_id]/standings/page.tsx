import StandingsTable, { type Player } from '@/app/components/StandingsTable'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: members } = await supabase
    .from('room_players')
    .select('user_id, points')
    .eq('room_id', room_id)

  const memberUserIds = (members ?? []).map((member) => member.user_id)

  const { data: profiles } = memberUserIds.length
    ? await supabase.from('profiles').select('id, username').in('id', memberUserIds)
    : { data: [] }

  const usernameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]))

  const players: Player[] = (members ?? []).map((member) => ({
    username: usernameById.get(member.user_id) ?? member.user_id.slice(0, 8),
    points: member.points,
  }))

  return (
    <div>
      {players.length > 0 ? (
        <StandingsTable players={players} />
      ) : (
        <div className="text-center py-12 text-text-muted">
          <p>No players in this room yet</p>
        </div>
      )}
    </div>
  )
}

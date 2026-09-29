import StandingsTable, { type Player } from '@/app/components/StandingsTable'
import EmptyState from '@/app/components/EmptyState'
import { Users } from 'lucide-react'
import { getCachedStandingPlayers } from '@/app/utils/cache/roomReads'
import { requireRoomAccess } from '@/app/utils/rooms/requireRoomAccess'

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  await requireRoomAccess(room_id)
  const players: Player[] = await getCachedStandingPlayers(room_id)

  return (
    <div>
      {players.length > 0 ? (
        <StandingsTable players={players} />
      ) : (
        <EmptyState icon={Users} title="No players in this room yet" />
      )}
    </div>
  )
}

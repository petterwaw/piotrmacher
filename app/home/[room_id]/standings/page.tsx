import type { Metadata } from 'next'
import StandingsTable, { type Player } from '@/app/components/StandingsTable'
import EmptyState from '@/app/components/EmptyState'
import { Users } from 'lucide-react'
import { getRoomStandings } from '@/app/utils/cache/sharedReads'
import { requireRoomAccess } from '@/app/utils/rooms/requireRoomAccess'

export const metadata: Metadata = { title: 'Standings' }

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  await requireRoomAccess(room_id)
  const players: Player[] = await getRoomStandings(room_id)

  return (
    <div>
      <h1 className="sr-only">Standings</h1>
      {players.length > 0 ? (
        <StandingsTable players={players} />
      ) : (
        <EmptyState icon={Users} title="No players in this room yet" />
      )}
    </div>
  )
}

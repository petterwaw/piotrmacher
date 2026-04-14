import StandingsTable, { type Player } from '@/app/components/StandingsTable'
import roomsData from '@/app/data/rooms.mock.json'

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params

  // Find room data and extract players
  const room = roomsData.find((r) => r.id === room_id) as any
  const players: Player[] = room?.players || []

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-main mb-6">Standings</h2>
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

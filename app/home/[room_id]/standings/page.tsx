import StandingsTable, { type Player } from '@/app/components/StandingsTable'
import { getCachedStandingPlayers } from '@/app/utils/cache/roomReads'

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  const players: Player[] = await getCachedStandingPlayers(room_id)

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

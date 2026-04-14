export interface Player {
  username: string
  points: number
}

export default function StandingsTable({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.points - a.points)

  return (
    <div className="bg-white border border-border-soft rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-soft bg-bg-page">
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-main">Rank</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-main">Player</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-text-main">Points</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((player, index) => (
            <tr key={player.username} className="border-b border-border-soft hover:bg-bg-page transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-text-muted">#{index + 1}</td>
              <td className="px-4 py-3 text-sm text-text-main font-medium">{player.username}</td>
              <td className="px-4 py-3 text-sm font-semibold text-right text-brand">{player.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

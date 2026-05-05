export interface Player {
  username: string
  points: number
}

export default function StandingsTable({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.points - a.points)

  return (
    <div className="space-y-3">
      {sorted.map((player, index) => (
        <div
          key={player.username}
          className="flex items-center justify-between border-2 border-zinc-300 bg-white/90 p-4 transition-all duration-200 hover:border-brand hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <span className={`w-10 text-lg font-black ${
              index === 0 ? 'text-[#F59E0B]' : index === 1 ? 'text-[#9CA3AF]' : index === 2 ? 'text-[#B45309]' : 'text-text-muted'
            }`}>#{index + 1}</span>
            <span className="font-semibold text-text-main">{player.username}</span>
          </div>
          <span className="text-lg font-black text-brand">{player.points} pts</span>
        </div>
      ))}
    </div>
  )
}

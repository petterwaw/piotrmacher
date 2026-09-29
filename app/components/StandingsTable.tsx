export interface Player {
  username: string
  points: number
  outcomeHits: number
  outcomeTotal: number
}

// Podium ranks get a filled badge (gold / silver / bronze) with AA-contrast text.
const podiumStyles = [
  'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
  'bg-zinc-200 text-zinc-800 ring-1 ring-zinc-300',
  'bg-orange-100 text-orange-900 ring-1 ring-orange-300',
]

export default function StandingsTable({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.points - a.points)

  return (
    <ol className="stagger space-y-2 sm:space-y-3" aria-label="Standings">
      {sorted.map((player, index) => (
        <li
          key={player.username}
          className={`flex items-center justify-between gap-3 border-2 bg-white/90 px-3 py-3 sm:px-4 ${
            index === 0 ? 'border-brand' : 'border-zinc-300'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span
              className={`inline-flex h-9 w-11 shrink-0 items-center justify-center text-base font-black tabular-nums ${
                podiumStyles[index] ?? 'text-zinc-600'
              }`}
            >
              <span className="sr-only">Place </span>
              <span aria-hidden="true">#</span>
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-text-main">{player.username}</span>
              <span className="text-xs tabular-nums text-zinc-600">
                {player.outcomeTotal > 0 ? (
                  <>
                    <span className="font-semibold text-text-main">
                      {Math.round((player.outcomeHits / player.outcomeTotal) * 100)}%
                    </span>{' '}
                    results right ({player.outcomeHits}/{player.outcomeTotal})
                  </>
                ) : (
                  'No results yet'
                )}
              </span>
            </span>
          </div>
          <span className="shrink-0 text-right">
            <span className="text-lg font-black tabular-nums text-brand">{player.points}</span>
            <span className="ml-1 text-sm font-semibold text-zinc-600">
              <span aria-hidden="true">pts</span>
              <span className="sr-only">{player.points === 1 ? 'point' : 'points'}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

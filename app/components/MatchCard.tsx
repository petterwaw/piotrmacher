export interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  homeOdds: number
  drawOdds: number
  awayOdds: number
  startTime: string
  result?: 'home' | 'draw' | 'away' | null
}

export default function MatchCard({ match }: { match: Match }) {
  return (
    <div className="bg-white border border-border-soft rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="text-sm text-text-muted mb-2">
            {new Date(match.startTime).toLocaleString()}
          </div>
          <div className="text-lg font-semibold text-text-main">
            {match.homeTeam} vs {match.awayTeam}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button className="btn-base btn-light text-sm py-2">
          <div className="font-semibold">{match.homeTeam}</div>
          <div className="text-xs text-text-muted">{match.homeOdds}</div>
        </button>
        <button className="btn-base btn-light text-sm py-2">
          <div className="font-semibold">Draw</div>
          <div className="text-xs text-text-muted">{match.drawOdds}</div>
        </button>
        <button className="btn-base btn-light text-sm py-2">
          <div className="font-semibold">{match.awayTeam}</div>
          <div className="text-xs text-text-muted">{match.awayOdds}</div>
        </button>
      </div>

      {match.result && (
        <div className="text-center text-sm bg-success bg-opacity-10 text-success rounded p-2">
          Result: {match.result === 'home' ? match.homeTeam : match.result === 'away' ? match.awayTeam : 'Draw'}
        </div>
      )}
    </div>
  )
}

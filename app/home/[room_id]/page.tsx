import MatchCard, { type Match } from '@/app/components/MatchCard'
import { sampleMatch } from '@/app/data/matches.mock'

export default function BetsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-main mb-6">Available Bets</h2>
      <MatchCard match={sampleMatch as Match} />
    </div>
  )
}
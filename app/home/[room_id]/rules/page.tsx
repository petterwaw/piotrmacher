import { getCachedRoomRules } from '@/app/utils/cache/roomReads'
import ScoreTester from '@/app/components/ScoreTester'

type Rules = {
  correct_winner: number
  correct_draw: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

const ruleLabels: Array<{ key: keyof Rules; label: string }> = [
  { key: 'correct_winner', label: 'Correct winner' },
  { key: 'correct_draw', label: 'Correct draw' },
  { key: 'correct_difference', label: 'Correct goal difference' },
  { key: 'correct_home_goals', label: 'Correct team goals' },
  { key: 'exact_score', label: 'Exact score' },
  { key: 'exact_draw', label: 'Exact draw' },
]

const ruleDescriptions: Record<keyof Rules, { explain: string; example: string }> = {
  correct_winner: {
    explain: 'You get points when you predict the same non-draw outcome: home win or away win.',
    example: 'Example: your pick 2:1, final score 3:0 -> both are home wins, so winner points are awarded.',
  },
  correct_draw: {
    explain: 'You get points when both your pick and final outcome are a draw.',
    example: 'Example: your pick 1:1, final score 2:2 -> draw points are awarded.',
  },
  correct_difference: {
    explain: 'You get points when your goal difference matches the final goal difference.',
    example: 'Example: your pick 2:0, final score 3:1 -> difference is +2 in both scores.',
  },
  correct_home_goals: {
    explain: 'You get points if you predict the exact number of goals for a team. This rule applies to both teams using the same value.',
    example: 'Example: your pick 2:1, final score 2:3 -> you get home-team-goals points (home goals are 2).',
  },
  correct_away_goals: {
    explain: 'Away goals use the same value as team goals and are included in the same row in this view.',
    example: 'Example: your pick 1:2, final score 3:2 -> you get away-team-goals points (away goals are 2).',
  },
  exact_score: {
    explain: 'You get points when both home and away goals are predicted exactly for a non-draw final score.',
    example: 'Example: your pick 2:1, final score 2:1 -> exact score points are awarded.',
  },
  exact_draw: {
    explain: 'You get points when you predict the exact draw score.',
    example: 'Example: your pick 1:1, final score 1:1 -> exact draw points are awarded.',
  },
}

const defaultRules: Rules = {
  correct_winner: 1,
  correct_draw: 1,
  correct_difference: 1,
  correct_away_goals: 1,
  correct_home_goals: 1,
  exact_score: 1,
  exact_draw: 1,
}

export default async function RulesPage({
  params,
}: {
  params: Promise<{ room_id: string }>
}) {
  const { room_id } = await params
  const rules = {
    ...defaultRules,
    ...(await getCachedRoomRules(room_id) ?? {}),
  }
  const teamGoalsPoints = Math.max(rules.correct_home_goals, rules.correct_away_goals)

  return (
    <div>
      <div className="border-2 border-zinc-300 bg-white p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-text-main mb-2">Betting Rules</h3>
          <div className="mb-4 border border-zinc-200 bg-zinc-50 p-3 text-sm text-text-main">
            <p className="font-semibold">Cup matches are settled after 90 minutes only.</p>
            <p className="mt-1 text-text-muted">Extra time and penalties are not supported in room scoring yet.</p>
          </div>
          <ul className="space-y-2 text-text-muted">
            {ruleLabels.map((rule) => (
              <li key={rule.key} className="border-b border-border-soft py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-text-main">{rule.label}</span>
                  <span className="font-semibold text-text-main">
                    {rule.key === 'correct_home_goals' ? teamGoalsPoints : rules[rule.key]} pts
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  <p>{ruleDescriptions[rule.key].explain}</p>
                  <p>{ruleDescriptions[rule.key].example}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <ScoreTester rules={rules} />
      </div>
    </div>
  )
}

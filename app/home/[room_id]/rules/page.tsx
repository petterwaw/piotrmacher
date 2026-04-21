import { createServerSupabaseClient } from '@/app/utils/supabase/server'

type Rules = {
  correct_winner: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

const ruleLabels: Array<{ key: keyof Rules; label: string }> = [
  { key: 'correct_winner', label: 'Correct winner' },
  { key: 'correct_difference', label: 'Correct goal difference' },
  { key: 'correct_away_goals', label: 'Correct away goals' },
  { key: 'correct_home_goals', label: 'Correct home goals' },
  { key: 'exact_score', label: 'Exact score' },
  { key: 'exact_draw', label: 'Exact draw' },
]

const defaultRules: Rules = {
  correct_winner: 1,
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
  const supabase = await createServerSupabaseClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('rules')
    .eq('id', room_id)
    .maybeSingle()

  const rules = (room?.rules as Rules | null) ?? defaultRules

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-main mb-6">Rules</h2>
      <div className="bg-white border border-border-soft rounded-lg p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-text-main mb-2">Betting Rules</h3>
          <ul className="space-y-2 text-text-muted">
            {ruleLabels.map((rule) => (
              <li key={rule.key} className="flex items-center justify-between gap-3 border-b border-border-soft py-2">
                <span>{rule.label}</span>
                <span className="font-semibold text-text-main">{rules[rule.key]} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

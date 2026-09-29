// Mirrors calculatePoints in app/utils/scoring/processPendingScoringJobs.ts so
// the Rules page and the score tester explain exactly what the scorer does.

export type MatchRules = {
  correct_winner: number
  correct_draw: number
  correct_difference: number
  correct_home_goals: number
  correct_away_goals: number
  exact_score: number
  exact_draw: number
}

export type PointsLine = {
  key: keyof MatchRules
  label: string
  detail: string
  hit: boolean
  pts: number
}

export function rulePoints(rules: MatchRules, key: keyof MatchRules) {
  const value = Number(rules[key])
  return Number.isFinite(value) && value > 0 ? value : 0
}

function outcome(home: number, away: number) {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function signed(diff: number) {
  return diff > 0 ? `+${diff}` : String(diff)
}

const OUTCOME_LABEL = { home: 'home win', away: 'away win', draw: 'draw' } as const
const PICKED = { home: 'you picked a home win', away: 'you picked an away win', draw: 'you picked a draw' } as const

// Every rule that could apply to this pick, in the order the scorer checks
// them. Lines with `hit: false` explain why a rule did not pay out.
export function pointsBreakdown(
  predHome: number,
  predAway: number,
  finalHome: number,
  finalAway: number,
  rules: MatchRules,
) {
  const predOutcome = outcome(predHome, predAway)
  const finalOutcome = outcome(finalHome, finalAway)
  const isExact = predHome === finalHome && predAway === finalAway
  const lines: PointsLine[] = []

  if (finalOutcome === 'draw') {
    lines.push({
      key: 'correct_draw',
      label: 'Correct draw',
      detail: predOutcome === 'draw' ? 'both draws' : PICKED[predOutcome],
      hit: predOutcome === 'draw',
      pts: rulePoints(rules, 'correct_draw'),
    })
  } else {
    lines.push({
      key: 'correct_winner',
      label: 'Correct winner',
      detail:
        predOutcome === finalOutcome
          ? `both ${OUTCOME_LABEL[finalOutcome]}s`
          : PICKED[predOutcome],
      hit: predOutcome === finalOutcome,
      pts: rulePoints(rules, 'correct_winner'),
    })
  }

  const predDiff = predHome - predAway
  const finalDiff = finalHome - finalAway
  lines.push({
    key: 'correct_difference',
    label: 'Goal difference',
    detail: predDiff === finalDiff ? `${signed(finalDiff)} in both` : `${signed(predDiff)} vs ${signed(finalDiff)}`,
    hit: predDiff === finalDiff,
    pts: rulePoints(rules, 'correct_difference'),
  })

  lines.push({
    key: 'correct_home_goals',
    label: 'Home goals',
    detail: predHome === finalHome ? `${finalHome} in both` : `${predHome} vs ${finalHome}`,
    hit: predHome === finalHome,
    pts: rulePoints(rules, 'correct_home_goals'),
  })

  lines.push({
    key: 'correct_away_goals',
    label: 'Away goals',
    detail: predAway === finalAway ? `${finalAway} in both` : `${predAway} vs ${finalAway}`,
    hit: predAway === finalAway,
    pts: rulePoints(rules, 'correct_away_goals'),
  })

  const exactKey = finalOutcome === 'draw' ? 'exact_draw' : 'exact_score'
  lines.push({
    key: exactKey,
    label: finalOutcome === 'draw' ? 'Exact draw' : 'Exact score',
    detail: isExact ? 'spot on' : 'not exact',
    hit: isExact,
    pts: rulePoints(rules, exactKey),
  })

  const total = lines.reduce((sum, line) => (line.hit ? sum + line.pts : sum), 0)
  return { lines, total }
}

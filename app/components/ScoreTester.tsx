'use client'

import { useState } from 'react'

type Rules = {
  correct_winner: number
  correct_draw: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

const MAX_GOALS = 20

function calcPoints(
  predHome: number,
  predAway: number,
  finalHome: number,
  finalAway: number,
  rules: Rules,
): { breakdown: { label: string; pts: number }[]; total: number } {
  const breakdown: { label: string; pts: number }[] = []

  const predDiff = predHome - predAway
  const finalDiff = finalHome - finalAway
  const predWinner = predDiff > 0 ? 1 : predDiff < 0 ? -1 : 0
  const finalWinner = finalDiff > 0 ? 1 : finalDiff < 0 ? -1 : 0
  const isDraw = finalHome === finalAway

  if (predHome === finalHome && predAway === finalAway) {
    if (isDraw) {
      breakdown.push({ label: 'Exact draw', pts: rules.exact_draw })
    } else {
      breakdown.push({ label: 'Exact score', pts: rules.exact_score })
    }
  }

  if (predWinner === 0 && finalWinner === 0) {
    breakdown.push({ label: 'Correct draw', pts: rules.correct_draw })
  } else if (predWinner === finalWinner) {
    breakdown.push({ label: 'Correct winner', pts: rules.correct_winner })
  }

  if (predDiff === finalDiff) {
    breakdown.push({ label: 'Correct goal difference', pts: rules.correct_difference })
  }

  if (predHome === finalHome) {
    breakdown.push({ label: 'Correct team goals (home)', pts: rules.correct_home_goals })
  }

  if (predAway === finalAway) {
    breakdown.push({ label: 'Correct team goals (away)', pts: rules.correct_away_goals })
  }

  const total = breakdown.reduce((sum, b) => sum + b.pts, 0)
  return { breakdown, total }
}

export default function ScoreTester({ rules }: { rules: Rules }) {
  const [predHome, setPredHome] = useState(0)
  const [predAway, setPredAway] = useState(0)
  const [finalHome, setFinalHome] = useState(0)
  const [finalAway, setFinalAway] = useState(0)

  const result = calcPoints(predHome, predAway, finalHome, finalAway, rules)

  const decrease = (setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter((prev) => Math.max(0, prev - 1))
  }

  const increase = (setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter((prev) => Math.min(MAX_GOALS, prev + 1))
  }

  const GoalStepper = ({
    value,
    onIncrease,
    onDecrease,
  }: {
    value: number
    onIncrease: () => void
    onDecrease: () => void
  }) => (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onIncrease}
        className="h-8 w-8 border-2 border-brand bg-brand text-base font-bold leading-none text-white transition-colors hover:border-brand-soft hover:bg-brand-soft"
      >
        +
      </button>
      <span className="w-8 text-center font-mono text-2xl font-bold text-text-main">{value}</span>
      <button
        type="button"
        onClick={onDecrease}
        className="h-8 w-8 border-2 border-zinc-300 bg-white text-base font-bold leading-none text-text-main transition-colors hover:border-zinc-400"
      >
        -
      </button>
    </div>
  )

  const ScorePairControl = ({
    home,
    away,
    onIncreaseHome,
    onDecreaseHome,
    onIncreaseAway,
    onDecreaseAway,
  }: {
    home: number
    away: number
    onIncreaseHome: () => void
    onDecreaseHome: () => void
    onIncreaseAway: () => void
    onDecreaseAway: () => void
  }) => (
    <div className="border-2 border-zinc-300 bg-white px-4 py-3">
      <div className="flex items-center justify-center gap-4">
        <GoalStepper value={home} onIncrease={onIncreaseHome} onDecrease={onDecreaseHome} />
        <span className="text-2xl font-bold text-zinc-500">:</span>
        <GoalStepper value={away} onIncrease={onIncreaseAway} onDecrease={onDecreaseAway} />
      </div>
    </div>
  )

  return (
    <div className="mt-6 border-2 border-zinc-300 bg-zinc-50 p-4">
      <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-text-main">Score tester</h4>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Your pick</label>
            <ScorePairControl
              home={predHome}
              away={predAway}
              onIncreaseHome={() => increase(setPredHome)}
              onDecreaseHome={() => decrease(setPredHome)}
              onIncreaseAway={() => increase(setPredAway)}
              onDecreaseAway={() => decrease(setPredAway)}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Final score</label>
            <ScorePairControl
              home={finalHome}
              away={finalAway}
              onIncreaseHome={() => increase(setFinalHome)}
              onDecreaseHome={() => decrease(setFinalHome)}
              onIncreaseAway={() => increase(setFinalAway)}
              onDecreaseAway={() => decrease(setFinalAway)}
            />
          </div>
        </div>

        <div className="w-full shrink-0 border-2 border-zinc-300 bg-white p-3 xl:w-[300px]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Points summary</p>
          <div className="space-y-1">
            {result.breakdown.length === 0 ? (
              <p className="text-xs text-zinc-500">No points scored.</p>
            ) : (
              result.breakdown.map((b) => (
                <div key={b.label} className="flex items-center justify-between text-xs text-zinc-600">
                  <span>{b.label}</span>
                  <span className="font-bold text-brand">+{b.pts}</span>
                </div>
              ))
            )}
            <div className="mt-2 flex items-center justify-between border-t border-zinc-300 pt-2 text-sm font-bold text-text-main">
              <span>Total</span>
              <span className="text-brand">{result.total} pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

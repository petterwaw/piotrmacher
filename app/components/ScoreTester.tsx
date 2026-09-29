'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Minus, Plus } from 'lucide-react'

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

function GoalStepper({
  value,
  label,
  onIncrease,
  onDecrease,
}: {
  value: number
  label: string
  onIncrease: () => void
  onDecrease: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onIncrease}
        disabled={value >= MAX_GOALS}
        aria-label={`Increase ${label}`}
        className="touch-target inline-flex h-10 w-10 items-center justify-center border-2 border-brand bg-brand text-white transition-colors hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:opacity-40 disabled:hover:bg-brand"
      >
        <Plus size={18} strokeWidth={3} aria-hidden="true" />
      </button>
      <span className="w-10 text-center text-3xl font-black leading-none tabular-nums text-text-main">{value}</span>
      <button
        type="button"
        onClick={onDecrease}
        disabled={value <= 0}
        aria-label={`Decrease ${label}`}
        className="touch-target inline-flex h-10 w-10 items-center justify-center border-2 border-zinc-300 bg-white text-text-main transition-colors hover:border-zinc-500 active:bg-zinc-100 disabled:opacity-40 disabled:hover:border-zinc-300"
      >
        <Minus size={18} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}

function ScorePairControl({
  label,
  home,
  away,
  onIncreaseHome,
  onDecreaseHome,
  onIncreaseAway,
  onDecreaseAway,
}: {
  label: string
  home: number
  away: number
  onIncreaseHome: () => void
  onDecreaseHome: () => void
  onIncreaseAway: () => void
  onDecreaseAway: () => void
}) {
  return (
    <div className="border-2 border-zinc-300 bg-white px-4 py-3">
      <div className="flex items-center justify-center gap-4">
        <GoalStepper value={home} label={`${label} home goals`} onIncrease={onIncreaseHome} onDecrease={onDecreaseHome} />
        <span aria-hidden="true" className="text-2xl font-black text-zinc-400">:</span>
        <GoalStepper value={away} label={`${label} away goals`} onIncrease={onIncreaseAway} onDecrease={onDecreaseAway} />
      </div>
    </div>
  )
}

export default function ScoreTester({ rules }: { rules: Rules }) {
  const [predHome, setPredHome] = useState(0)
  const [predAway, setPredAway] = useState(0)
  const [finalHome, setFinalHome] = useState(0)
  const [finalAway, setFinalAway] = useState(0)

  const result = calcPoints(predHome, predAway, finalHome, finalAway, rules)

  const decrease = (setter: Dispatch<SetStateAction<number>>) => {
    setter((prev) => Math.max(0, prev - 1))
  }

  const increase = (setter: Dispatch<SetStateAction<number>>) => {
    setter((prev) => Math.min(MAX_GOALS, prev + 1))
  }

  return (
    <div className="mt-6 border-2 border-zinc-300 bg-zinc-50 p-4 sm:p-5">
      <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-text-main">Score tester</h4>
      <div className="flex flex-col gap-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-600">Your pick</p>
            <ScorePairControl
              label="your pick"
              home={predHome}
              away={predAway}
              onIncreaseHome={() => increase(setPredHome)}
              onDecreaseHome={() => decrease(setPredHome)}
              onIncreaseAway={() => increase(setPredAway)}
              onDecreaseAway={() => decrease(setPredAway)}
            />
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-600">Final score</p>
            <ScorePairControl
              label="final score"
              home={finalHome}
              away={finalAway}
              onIncreaseHome={() => increase(setFinalHome)}
              onDecreaseHome={() => decrease(setFinalHome)}
              onIncreaseAway={() => increase(setFinalAway)}
              onDecreaseAway={() => decrease(setFinalAway)}
            />
          </div>
        </div>

        <div className="w-full border-2 border-zinc-300 bg-white p-3 sm:p-4" aria-live="polite">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-600">Points summary</p>
          <div className="space-y-1.5">
            {result.breakdown.length === 0 ? (
              <p className="text-sm text-zinc-600">No points scored.</p>
            ) : (
              result.breakdown.map((b) => (
                <div key={b.label} className="flex items-center justify-between gap-3 text-sm text-zinc-700">
                  <span>{b.label}</span>
                  <span className="font-bold tabular-nums text-brand">+{b.pts}</span>
                </div>
              ))
            )}
            <div className="mt-2 flex items-center justify-between border-t-2 border-zinc-200 pt-2 text-base font-black text-text-main">
              <span>Total</span>
              <span className="tabular-nums text-brand">{result.total} pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

type Rules = {
  correct_winner: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

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

  if (predWinner === finalWinner) {
    breakdown.push({ label: 'Correct winner', pts: rules.correct_winner })
  }

  if (predDiff === finalDiff && predDiff !== 0) {
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

function parseScore(val: string): [number, number] | null {
  const match = val.trim().match(/^(\d+)\s*[:\-]\s*(\d+)$/)
  if (!match) return null
  return [parseInt(match[1], 10), parseInt(match[2], 10)]
}

export default function ScoreTester({ rules }: { rules: Rules }) {
  const [pred, setPred] = useState('')
  const [final, setFinal] = useState('')

  const predParsed = parseScore(pred)
  const finalParsed = parseScore(final)
  const canCalc = predParsed !== null && finalParsed !== null

  const result = canCalc
    ? calcPoints(predParsed[0], predParsed[1], finalParsed[0], finalParsed[1], rules)
    : null

  return (
    <div className="mt-6 border-2 border-zinc-300 bg-zinc-50 p-4">
      <h4 className="mb-3 text-sm font-bold text-text-main">Score tester</h4>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wide">Your pick</label>
          <input
            type="text"
            value={pred}
            onChange={(e) => setPred(e.target.value)}
            placeholder="2:1"
            className="w-20 border-2 border-zinc-300 bg-white px-2 py-1.5 text-center text-sm font-semibold outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500 uppercase tracking-wide">Final score</label>
          <input
            type="text"
            value={final}
            onChange={(e) => setFinal(e.target.value)}
            placeholder="3:1"
            className="w-20 border-2 border-zinc-300 bg-white px-2 py-1.5 text-center text-sm font-semibold outline-none focus:border-brand"
          />
        </div>
        {result && (
          <div className="flex-1 min-w-[160px]">
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
        )}
        {!canCalc && (pred || final) && (
          <p className="text-xs text-zinc-400">Enter scores as e.g. 2:1</p>
        )}
      </div>
    </div>
  )
}

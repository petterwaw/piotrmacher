'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Minus, Plus } from 'lucide-react'
import Breakdown from './Breakdown'
import { pointsBreakdown, type MatchRules } from './points'

const MAX_GOALS = 20

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
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onIncrease}
        disabled={value >= MAX_GOALS}
        aria-label={`Increase ${label}`}
        className="inline-flex h-11 w-11 items-center justify-center border-2 border-brand bg-brand text-white transition-colors hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:opacity-40 disabled:hover:bg-brand"
      >
        <Plus size={18} strokeWidth={3} aria-hidden="true" />
      </button>
      <output aria-label={label} aria-live="off" className="w-11 text-center text-3xl font-black leading-10 tabular-nums text-text-main">
        {value}
      </output>
      <button
        type="button"
        onClick={onDecrease}
        disabled={value <= 0}
        aria-label={`Decrease ${label}`}
        className="inline-flex h-11 w-11 items-center justify-center border-2 border-zinc-300 bg-white text-text-main transition-colors hover:border-zinc-500 active:bg-zinc-100 disabled:opacity-40 disabled:hover:border-zinc-300"
      >
        <Minus size={18} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}

function ScorePair({
  title,
  label,
  home,
  away,
  setHome,
  setAway,
}: {
  title: string
  label: string
  home: number
  away: number
  setHome: Dispatch<SetStateAction<number>>
  setAway: Dispatch<SetStateAction<number>>
}) {
  const increase = (setter: Dispatch<SetStateAction<number>>) => setter((prev) => Math.min(MAX_GOALS, prev + 1))
  const decrease = (setter: Dispatch<SetStateAction<number>>) => setter((prev) => Math.max(0, prev - 1))

  return (
    <fieldset className="min-w-0 border-2 border-zinc-300 px-3 pb-3 pt-1">
      <legend className="px-1.5 text-sm font-bold text-text-main">{title}</legend>
      <div className="flex items-center justify-center gap-2">
        <GoalStepper value={home} label={`${label} home goals`} onIncrease={() => increase(setHome)} onDecrease={() => decrease(setHome)} />
        <span aria-hidden="true" className="text-2xl font-black text-zinc-400">:</span>
        <GoalStepper value={away} label={`${label} away goals`} onIncrease={() => increase(setAway)} onDecrease={() => decrease(setAway)} />
      </div>
    </fieldset>
  )
}

export default function ScoreTester({ rules }: { rules: MatchRules }) {
  const [predHome, setPredHome] = useState(2)
  const [predAway, setPredAway] = useState(1)
  const [finalHome, setFinalHome] = useState(2)
  const [finalAway, setFinalAway] = useState(1)

  const result = pointsBreakdown(predHome, predAway, finalHome, finalAway, rules)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <ScorePair title="Your pick" label="your pick" home={predHome} away={predAway} setHome={setPredHome} setAway={setPredAway} />
        <ScorePair title="After 90 min" label="final score" home={finalHome} away={finalAway} setHome={setFinalHome} setAway={setFinalAway} />
      </div>
      {/* One short announcement per change instead of re-reading the whole breakdown. */}
      <p aria-live="polite" className="sr-only">
        {`Your pick ${predHome}:${predAway}, final score ${finalHome}:${finalAway}: ${result.total} ${result.total === 1 ? 'point' : 'points'}.`}
      </p>
      <Breakdown lines={result.lines} total={result.total} />
    </div>
  )
}

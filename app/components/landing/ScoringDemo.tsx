'use client'

import { Check, Minus, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { displayFont } from './fonts'

// Mirrors the room scoring (app/utils/scoring) with every rule at its
// default value of 1 point. Rules stack: one pick can satisfy several.
const FINAL = { home: 2, away: 1 }
const MAX_GOALS = 9

type Pick = { home: number; away: number }

function outcome(home: number, away: number) {
  return home > away ? 'home' : away > home ? 'away' : 'draw'
}

function scoreRules(pick: Pick) {
  const exact = pick.home === FINAL.home && pick.away === FINAL.away
  const finalIsDraw = FINAL.home === FINAL.away
  const sameOutcome = outcome(pick.home, pick.away) === outcome(FINAL.home, FINAL.away)

  return [
    { label: finalIsDraw ? 'Correct draw' : 'Correct winner', hit: sameOutcome },
    { label: 'Correct goal difference', hit: pick.home - pick.away === FINAL.home - FINAL.away },
    { label: 'Arsenal goals', hit: pick.home === FINAL.home },
    { label: 'Chelsea goals', hit: pick.away === FINAL.away },
    { label: finalIsDraw ? 'Exact draw' : 'Exact score', hit: exact },
  ]
}

function total(pick: Pick) {
  return scoreRules(pick).filter((rule) => rule.hit).length
}

const FRIENDS: Array<{ name: string; pick: Pick }> = [
  { name: 'Kasia', pick: { home: 2, away: 1 } },
  { name: 'Tomek', pick: { home: 3, away: 1 } },
  { name: 'Marek', pick: { home: 1, away: 1 } },
  { name: 'Ola', pick: { home: 0, away: 2 } },
]

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Stepper({
  team,
  value,
  onChange,
}: {
  team: string
  value: number
  onChange: (next: number) => void
}) {
  const buttonClass =
    'inline-flex h-11 w-11 items-center justify-center border-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E20] disabled:cursor-not-allowed disabled:opacity-40'

  return (
    // Below 360px (e.g. 320px / 400% zoom) the steppers stack vertically so the
    // demo reflows without horizontal scrolling.
    <div className="flex items-center gap-2 max-[359px]:flex-col" role="group" aria-label={`${team} goals in your pick`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label={`${team} goals, decrease`}
        className={`${buttonClass} border-zinc-300 bg-white text-[#0F1A12] hover:border-[#2E7D32]`}
      >
        <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <output
        aria-live="off"
        className={`${displayFont.className} w-9 text-center text-5xl font-extrabold leading-none tabular-nums text-[#0F1A12]`}
      >
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX_GOALS, value + 1))}
        disabled={value === MAX_GOALS}
        aria-label={`${team} goals, increase`}
        className={`${buttonClass} border-[#2E7D32] bg-[#2E7D32] text-white hover:border-[#1B5E20] hover:bg-[#1B5E20]`}
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function ScoringDemo() {
  const [pick, setPick] = useState<Pick>({ home: 1, away: 0 })
  const rules = scoreRules(pick)
  const yourPoints = rules.filter((rule) => rule.hit).length

  const table = [
    ...FRIENDS.map((friend) => ({ ...friend, points: total(friend.pick), you: false })),
    { name: 'You', pick, points: yourPoints, you: true },
  ].sort((a, b) => b.points - a.points)

  // Shared positions for tied points, like the room standings.
  const ranks = table.map((row) => 1 + table.filter((other) => other.points > row.points).length)

  // FLIP: your row slides to its new place when your pick changes the order.
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const lastTops = useRef(new Map<string, number>())
  const pointsRef = useRef<HTMLSpanElement | null>(null)
  const lastPoints = useRef(yourPoints)

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion()
    rowRefs.current.forEach((element, name) => {
      const top = element.getBoundingClientRect().top
      const previous = lastTops.current.get(name)
      lastTops.current.set(name, top)
      if (reduce || previous === undefined || previous === top) return
      element.animate(
        [{ transform: `translateY(${previous - top}px)` }, { transform: 'translateY(0)' }],
        { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
    })

    // The total rises into place when it changes; colour only under reduced motion.
    if (pointsRef.current && lastPoints.current !== yourPoints) {
      const up = yourPoints > lastPoints.current
      lastPoints.current = yourPoints
      pointsRef.current.animate(
        reduce
          ? [{ color: up ? '#4CAF50' : '#5B665F' }, { color: '#1B5E20' }]
          : [
              { transform: `translateY(${up ? 10 : -10}px)`, opacity: 0.2 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
        { duration: reduce ? 300 : 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
    }
  })

  return (
    <div className="border-2 border-zinc-300 bg-white shadow-[0_18px_40px_-24px_rgba(15,26,18,0.45)]">
      <div className="flex items-center justify-between gap-3 border-b-2 border-zinc-200 px-4 py-3 sm:px-5">
        <p className="text-sm font-bold text-[#3F4A43]">Premier League<span className="hidden sm:inline"> &middot; example match</span></p>
        <p className="whitespace-nowrap bg-[#0F1A12] px-2 py-1 text-sm font-bold text-white">Full time</p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-4 pt-5 sm:px-5">
        <p className="text-right text-base font-bold text-[#0F1A12]">Arsenal</p>
        <p className={`${displayFont.className} px-3 text-6xl font-extrabold leading-none tabular-nums text-[#0F1A12]`}>
          <span className="sr-only">{`Final score: Arsenal ${FINAL.home}, Chelsea ${FINAL.away}`}</span>
          <span aria-hidden="true">
            {FINAL.home}<span className="px-1 text-zinc-400">:</span>{FINAL.away}
          </span>
        </p>
        <p className="text-base font-bold text-[#0F1A12]">Chelsea</p>
      </div>

      <div className="border-t-2 border-dashed border-zinc-200 bg-[#F4F7F4] px-4 py-4 sm:px-5">
        <p className="text-center text-sm font-bold text-[#0F1A12]">Your pick, locked at kickoff</p>
        <p className="mt-0.5 text-center text-sm text-[#3F4A43]">Change it and watch the points.</p>
        {/* One concise announcement per change instead of the whole breakdown. */}
        <p aria-live="polite" className="sr-only">
          {`Your pick: Arsenal ${pick.home}, Chelsea ${pick.away}. ${yourPoints} ${yourPoints === 1 ? 'point' : 'points'}.`}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 sm:gap-5">
          <Stepper team="Arsenal" value={pick.home} onChange={(home) => setPick((p) => ({ ...p, home }))} />
          <span className={`${displayFont.className} text-4xl font-extrabold text-zinc-400`} aria-hidden="true">:</span>
          <Stepper team="Chelsea" value={pick.away} onChange={(away) => setPick((p) => ({ ...p, away }))} />
        </div>
      </div>

      <div className="grid gap-0 border-t-2 border-zinc-200 md:grid-cols-[1.1fr_1fr]">
        <div className="px-4 py-4 sm:px-5 md:border-r-2 md:border-zinc-200">
          <ul className="space-y-1.5" aria-label="Points for your pick">
            {rules.map((rule) => (
              <li
                key={rule.label}
                className={`flex items-center justify-between gap-3 text-sm transition-colors duration-200 ${rule.hit ? 'font-bold text-[#0F1A12]' : 'text-[#5B665F]'}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-200 ${rule.hit ? 'bg-[#2E7D32] text-white' : 'border border-zinc-300 text-zinc-400'}`}
                    aria-hidden="true"
                  >
                    {rule.hit ? <Check size={14} strokeWidth={3} /> : <Minus size={12} strokeWidth={2.5} />}
                  </span>
                  {rule.label}
                  <span className="sr-only">{rule.hit ? ', scored' : ', not scored'}</span>
                </span>
                <span className="tabular-nums" aria-hidden="true">{rule.hit ? '+1' : '0'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-baseline justify-between border-t-2 border-[#0F1A12] pt-2 text-[#0F1A12]">
            <span className="text-base font-bold">Your points</span>
            <span ref={pointsRef} className={`${displayFont.className} inline-block text-4xl font-extrabold leading-none tabular-nums text-[#1B5E20]`}>
              {yourPoints}
            </span>
          </p>
        </div>

        <div className="border-t-2 border-zinc-200 px-4 py-4 sm:px-5 md:border-t-0">
          <p className="text-sm font-bold text-[#0F1A12]">Room table after this match</p>
          <ol className="mt-2" aria-label="Example room table">
            {table.map((row, index) => (
              <li
                key={row.name}
                ref={(element) => {
                  if (element) rowRefs.current.set(row.name, element)
                  else rowRefs.current.delete(row.name)
                }}
                className={`relative grid grid-cols-[1.75rem_1fr_auto_2rem] items-center gap-2 border-b border-zinc-200 py-1.5 text-sm last:border-b-0 ${row.you ? 'z-10 -mx-2 bg-[#E3F1E4] px-2 font-bold text-[#0F1A12]' : 'text-[#27312B]'}`}
              >
                <span className="tabular-nums text-[#5B665F]">
                  <span className="sr-only">Place </span>
                  {ranks[index]}
                  <span aria-hidden="true">.</span>
                </span>
                <span>
                  {row.name}
                  <span className="sr-only">, pick</span>
                </span>
                <span className="tabular-nums text-[#5B665F]">
                  {row.pick.home}:{row.pick.away}
                  <span className="sr-only">,</span>
                </span>
                <span className="text-right font-bold tabular-nums">
                  {row.points}
                  <span className="sr-only"> {row.points === 1 ? 'point' : 'points'}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

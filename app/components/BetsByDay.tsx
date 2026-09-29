'use client'

import ScorePredictionCard, { type BasicMatch } from '@/app/components/ScorePredictionCard'
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react'
import EmptyState from '@/app/components/EmptyState'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
}

type BetsByDayMatch = {
  id: string
  livePredictions: LivePrediction[]
  match: BasicMatch
}

type Props = {
  roomId: string
  roomStatus: 'waiting' | 'active' | 'finished'
  visibleDaysAhead?: number
  matches: BetsByDayMatch[]
}

function toDayKey(isoDate: string) {
  const date = new Date(isoDate)
  return toLocalDayKey(date)
}

function toLocalDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayLabel(dayKey: string, todayKey: string, tomorrowKey: string) {
  if (dayKey === todayKey) return 'Today'
  if (dayKey === tomorrowKey) return 'Tomorrow'
  const date = new Date(`${dayKey}T00:00:00`)
  return date.toLocaleDateString('pl-PL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

// Smooth scrolling is motion: honour prefers-reduced-motion.
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function buildDayRange(daysAhead: number) {
  const start = startOfDay(new Date())
  return Array.from({ length: daysAhead + 1 }, (_, index) => {
    const day = addDays(start, index)
    return toLocalDayKey(day)
  })
}

export default function BetsByDay({ roomId, roomStatus, visibleDaysAhead = 7, matches }: Props) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime()),
    [matches]
  )

  const hasLiveMatch = useMemo(
    () => sortedMatches.some((item) => item.match.status === 'live'),
    [sortedMatches]
  )

  const dayKeys = useMemo(() => buildDayRange(visibleDaysAhead), [visibleDaysAhead])

  const todayKey = useMemo(() => toLocalDayKey(new Date()), [])
  const tomorrowKey = useMemo(() => toLocalDayKey(addDays(new Date(), 1)), [])

  const [selectedDay, setSelectedDay] = useState(() => dayKeys[0] ?? '')
  const activeDay = dayKeys.includes(selectedDay) ? selectedDay : dayKeys[0] ?? ''

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollButtons()
    const resizeObs = new ResizeObserver(updateScrollButtons)
    resizeObs.observe(el)
    el.addEventListener('scroll', updateScrollButtons)
    return () => {
      el.removeEventListener('scroll', updateScrollButtons)
      resizeObs.disconnect()
    }
  }, [updateScrollButtons])

  // Scroll active day button into view when selectedDay changes (also on mount)
  useEffect(() => {
    const container = scrollRef.current
    if (!container || !activeDay) return
    const activeBtn = container.querySelector<HTMLElement>('[data-day-active="true"]')
    activeBtn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: scrollBehavior() })
  }, [activeDay])

  useEffect(() => {
    if (roomStatus !== 'active') {
      return
    }

    const intervalMs = hasLiveMatch ? 30_000 : 90_000

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }

      router.refresh()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [hasLiveMatch, roomStatus, router])

  const filteredMatches = useMemo(() => {
    if (!activeDay) {
      return sortedMatches
    }

    return sortedMatches.filter((item) => toDayKey(item.match.startTime) === activeDay)
  }, [activeDay, sortedMatches])

  // Fade the edge of the day strip that has more days hidden behind it.
  const edgeMask =
    canScrollLeft || canScrollRight
      ? `linear-gradient(to right, ${canScrollLeft ? 'transparent 0, #000 24px' : '#000 0'}, ${canScrollRight ? '#000 calc(100% - 24px), transparent 100%' : '#000 100%'})`
      : undefined

  const scrollDays = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: scrollBehavior() })
  }

  return (
    <div className="space-y-4">
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={() => scrollDays(-120)}
          aria-label="Show earlier days"
          aria-hidden={canScrollLeft ? undefined : true}
          tabIndex={canScrollLeft ? undefined : -1}
          className={`hidden h-10 w-8 shrink-0 items-center justify-center text-zinc-600 transition-[color,opacity] hover:text-brand md:flex ${canScrollLeft ? '' : 'pointer-events-none opacity-0'}`}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <div
          ref={scrollRef}
          role="group"
          aria-label="Match day"
          style={{ maskImage: edgeMask, WebkitMaskImage: edgeMask }}
          className="hide-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1"
          onWheel={(event) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
              return
            }

            event.preventDefault()
            event.currentTarget.scrollLeft += event.deltaY
          }}
        >
          {dayKeys.map((dayKey) => {
            const isActive = dayKey === activeDay

            return (
              <button
                key={dayKey}
                type="button"
                data-day-active={isActive ? 'true' : undefined}
                aria-pressed={isActive}
                // Weekday/date labels are formatted in Polish; Today/Tomorrow are English.
                lang={dayKey === todayKey || dayKey === tomorrowKey ? undefined : 'pl'}
                onClick={() => setSelectedDay(dayKey)}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-2 px-3.5 text-sm font-bold uppercase tracking-wide tabular-nums transition-colors ${
                  isActive
                    ? 'border-brand bg-brand text-white'
                    : 'border-zinc-300 bg-white text-text-main hover:border-brand hover:text-brand active:bg-brand-tint'
                }`}
              >
                {formatDayLabel(dayKey, todayKey, tomorrowKey)}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollDays(120)}
          aria-label="Show later days"
          aria-hidden={canScrollRight ? undefined : true}
          tabIndex={canScrollRight ? undefined : -1}
          className={`hidden h-10 w-8 shrink-0 items-center justify-center text-zinc-600 transition-[color,opacity] hover:text-brand md:flex ${canScrollRight ? '' : 'pointer-events-none opacity-0'}`}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Keyed by day: switching days swaps the whole list, which rises in with
          a light stagger. Refreshes keep the key, so nothing replays. */}
      <div key={activeDay} className="stagger space-y-4">
        {filteredMatches.length > 0 ? (
          filteredMatches.map((item) => (
            <ScorePredictionCard
              key={item.id}
              roomId={roomId}
              roomStatus={roomStatus}
              livePredictions={item.livePredictions}
              match={item.match}
            />
          ))
        ) : (
          <EmptyState icon={CalendarX2} title="No matches on this day." hint="Pick another day above." />
        )}
      </div>
    </div>
  )
}

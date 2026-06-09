'use client'

import ScorePredictionCard, { type BasicMatch } from '@/app/components/ScorePredictionCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
    activeBtn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
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

  const scrollDays = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="space-y-4">
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={() => scrollDays(-120)}
          aria-label="Scroll left"
          className={`hidden shrink-0 p-1 text-text-muted transition-colors hover:text-text-main md:flex ${canScrollLeft ? '' : 'pointer-events-none opacity-0'}`}
        >
          <ChevronLeft size={18} />
        </button>

        <div
          ref={scrollRef}
          className="hide-scrollbar flex gap-2 overflow-x-auto pb-1"
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
                onClick={() => setSelectedDay(dayKey)}
                className={`whitespace-nowrap border-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition-colors ${
                  isActive
                    ? 'border-brand bg-brand text-white'
                    : 'border-zinc-300 bg-white text-text-main hover:border-brand hover:bg-gray-50'
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
          aria-label="Scroll right"
          className={`hidden shrink-0 p-1 text-text-muted transition-colors hover:text-text-main md:flex ${canScrollRight ? '' : 'pointer-events-none opacity-0'}`}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="space-y-4">
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
          <p className="py-10 text-center text-base text-text-muted">
            No matches on this day.
          </p>
        )}
      </div>
    </div>
  )
}

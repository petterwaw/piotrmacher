'use client'

import ScorePredictionCard, { type BasicMatch } from '@/app/components/ScorePredictionCard'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

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

function formatDayLabel(dayKey: string) {
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
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime()),
    [matches]
  )

  const hasLiveMatch = useMemo(
    () => sortedMatches.some((item) => item.match.status === 'live'),
    [sortedMatches]
  )

  const dayKeys = useMemo(() => buildDayRange(visibleDaysAhead), [visibleDaysAhead])
  const matchDayKeys = useMemo(
    () => new Set(sortedMatches.map((item) => toDayKey(item.match.startTime))),
    [sortedMatches]
  )

  const [selectedDay, setSelectedDay] = useState(() => dayKeys.find((dayKey) => matchDayKeys.has(dayKey)) ?? dayKeys[0] ?? '')

  useEffect(() => {
    if (dayKeys.length === 0) {
      setSelectedDay('')
      return
    }

    if (!dayKeys.includes(selectedDay)) {
      setSelectedDay(dayKeys.find((dayKey) => matchDayKeys.has(dayKey)) ?? dayKeys[0])
    }
  }, [dayKeys, matchDayKeys, selectedDay])

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
    if (!selectedDay) {
      return sortedMatches
    }

    return sortedMatches.filter((item) => toDayKey(item.match.startTime) === selectedDay)
  }, [selectedDay, sortedMatches])

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Matches are currently visible up to {visibleDaysAhead} days ahead.
      </p>

      <div
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
          const isActive = dayKey === selectedDay

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => setSelectedDay(dayKey)}
              className={`whitespace-nowrap border-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition-colors ${
                isActive
                  ? 'border-brand bg-brand text-white'
                  : 'border-zinc-300 bg-white text-text-main hover:border-brand hover:bg-gray-50'
              }`}
            >
              {formatDayLabel(dayKey)}
            </button>
          )
        })}
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
          <p className="border-2 border-dashed border-zinc-300 bg-white/80 px-4 py-5 text-sm text-text-muted">
            No matches on this day.
          </p>
        )}
      </div>
    </div>
  )
}

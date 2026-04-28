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
  matches: BetsByDayMatch[]
}

function toDayKey(isoDate: string) {
  const date = new Date(isoDate)
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

export default function BetsByDay({ roomId, roomStatus, matches }: Props) {
  const router = useRouter()
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.match.startTime).getTime() - new Date(b.match.startTime).getTime()),
    [matches]
  )

  const hasLiveMatch = useMemo(
    () => sortedMatches.some((item) => item.match.status === 'live'),
    [sortedMatches]
  )

  const dayKeys = useMemo(() => {
    const unique = new Set<string>()
    for (const item of sortedMatches) {
      unique.add(toDayKey(item.match.startTime))
    }
    return [...unique]
  }, [sortedMatches])

  const [selectedDay, setSelectedDay] = useState(dayKeys[0] ?? '')

  useEffect(() => {
    if (dayKeys.length === 0) {
      setSelectedDay('')
      return
    }

    if (!dayKeys.includes(selectedDay)) {
      setSelectedDay(dayKeys[0])
    }
  }, [dayKeys, selectedDay])

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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dayKeys.map((dayKey) => {
          const isActive = dayKey === selectedDay

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => setSelectedDay(dayKey)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-soft bg-white text-text-main hover:border-brand-soft'
              }`}
            >
              {formatDayLabel(dayKey)}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        {filteredMatches.map((item) => (
          <ScorePredictionCard
            key={item.id}
            roomId={roomId}
            roomStatus={roomStatus}
            livePredictions={item.livePredictions}
            match={item.match}
          />
        ))}
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState, useTransition } from 'react'

type MatchStatus = 'scheduled' | 'delayed' | 'live' | 'finished' | 'cancelled'

type Prediction = {
  home: number
  away: number
}

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
}

export type BasicMatch = {
  id: string
  homeTeam: string
  awayTeam: string
  startTime: string
  status: MatchStatus
  liveMinute?: number | null
  liveScore?: {
    home: number | null
    away: number | null
  }
  prediction: Prediction | null
}

type ScorePredictionCardProps = {
  roomId: string
  match: BasicMatch
  livePredictions?: LivePrediction[]
  roomStatus?: 'waiting' | 'active' | 'finished'
}

function normalizeScore(value: string) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function getStatusLabel(status: MatchStatus) {
  if (status === 'scheduled') return 'Scheduled'
  if (status === 'delayed') return 'Delayed'
  if (status === 'live') return 'Live'
  if (status === 'cancelled') return 'Cancelled'
  return 'Finished'
}

export default function ScorePredictionCard({
  roomId,
  match,
  livePredictions = [],
  roomStatus = 'waiting',
}: ScorePredictionCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [savedPrediction, setSavedPrediction] = useState<Prediction | null>(match.prediction)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isStarted = match.status === 'live' || match.status === 'finished' || match.status === 'cancelled'
  const isRoomActive = roomStatus === 'active'
  const canEdit = isRoomActive && !isStarted

  const statusClassName = useMemo(() => {
    if (match.status === 'live') return 'bg-green-100 text-green-800'
    if (match.status === 'finished') return 'bg-gray-100 text-gray-700'
    if (match.status === 'delayed') return 'bg-orange-100 text-orange-800'
    return 'bg-blue-100 text-blue-800'
  }, [match.status])

  const decreaseHome = () => setHomeScore((prev) => Math.max(0, prev - 1))
  const increaseHome = () => setHomeScore((prev) => prev + 1)

  const decreaseAway = () => setAwayScore((prev) => Math.max(0, prev - 1))
  const increaseAway = () => setAwayScore((prev) => prev + 1)

  const startEditing = () => {
    if (!canEdit) {
      return
    }

    setError(null)
    setIsEditing(true)
    setHomeScore(savedPrediction?.home ?? 0)
    setAwayScore(savedPrediction?.away ?? 0)
  }

  const cancelEditing = () => {
    setError(null)
    setIsEditing(false)
  }

  const handleSave = () => {
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/bets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            matchId: match.id,
            homeScore,
            awayScore,
          }),
        })

        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          bet?: { homeScore: number; awayScore: number }
        }

        if (!response.ok || !data.bet) {
          throw new Error(data.error || 'Could not save bet.')
        }

        setSavedPrediction({
          home: data.bet.homeScore,
          away: data.bet.awayScore,
        })
        setIsEditing(false)
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save bet.')
      }
    })
  }

  return (
    <div className="max-w-xl rounded-xl border border-border-soft bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-sm text-text-muted">
          {new Date(match.startTime).toLocaleString('pl-PL', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}>
          {getStatusLabel(match.status)}
        </span>
      </div>

      <div className="rounded-xl border border-border-soft p-4">
        {match.status === 'live' ? (
          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-red-600">
            <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
            <span>
              LIVE{typeof match.liveMinute === 'number' ? ` ${match.liveMinute}'` : ''}
            </span>
          </div>
        ) : null}

        <div className="mb-4 text-center text-base font-semibold text-text-main sm:text-lg">
          {match.homeTeam} - {match.awayTeam}
        </div>

        {(match.status === 'live' || match.status === 'finished') &&
        typeof match.liveScore?.home === 'number' &&
        typeof match.liveScore?.away === 'number' ? (
          <div className="mb-4 text-center">
            <span className={`text-3xl font-bold ${match.status === 'live' ? 'text-red-700' : 'text-text-main'}`}>
              {match.liveScore.home} : {match.liveScore.away}
            </span>
          </div>
        ) : null}

        {!isEditing ? (
          <div className="flex min-h-14 items-center justify-center">
            {!isStarted && savedPrediction ? (
              <span className="text-3xl font-bold text-text-main">
                {savedPrediction.home} : {savedPrediction.away}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-[72px_1fr_72px] items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <button type="button" className="btn-base btn-dark min-w-10 justify-center px-3 py-1" onClick={increaseHome}>
                +
              </button>
              <input
                type="number"
                min={0}
                value={homeScore}
                onChange={(event) => setHomeScore(normalizeScore(event.target.value))}
                className="w-14 rounded-md border border-border-soft py-1 text-center font-semibold text-text-main"
              />
              <button type="button" className="btn-base btn-light min-w-10 justify-center px-3 py-1" onClick={decreaseHome}>
                -
              </button>
            </div>

            <div className="text-center text-2xl font-semibold text-text-main">:</div>

            <div className="flex flex-col items-center gap-2">
              <button type="button" className="btn-base btn-dark min-w-10 justify-center px-3 py-1" onClick={increaseAway}>
                +
              </button>
              <input
                type="number"
                min={0}
                value={awayScore}
                onChange={(event) => setAwayScore(normalizeScore(event.target.value))}
                className="w-14 rounded-md border border-border-soft py-1 text-center font-semibold text-text-main"
              />
              <button type="button" className="btn-base btn-light min-w-10 justify-center px-3 py-1" onClick={decreaseAway}>
                -
              </button>
            </div>
          </div>
        )}
      </div>

      {!isRoomActive ? (
        <p className="mt-4 text-sm text-text-muted">
          Betting is disabled until host starts the room.
        </p>
      ) : null}

      {isStarted ? (
        <p className="mt-4 text-sm text-text-muted">Match started: editing is locked.</p>
      ) : null}

      {match.status === 'live' || match.status === 'finished' ? (
        <div className="mt-4 rounded-lg border border-border-soft bg-bg-page p-3">
          <p className="text-sm font-semibold text-text-main">Players bets</p>
          {livePredictions.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No bets submitted yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {livePredictions.map((item) => (
                <li key={`${item.username}-${item.homeScore}-${item.awayScore}`} className="flex items-center justify-between text-sm text-text-main">
                  <span>{item.username}</span>
                  <span className="font-semibold">
                    {item.homeScore} : {item.awayScore}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-5 flex items-center justify-end gap-3">
        {!isEditing ? (
          <button type="button" className="btn-base btn-light" onClick={startEditing} disabled={!canEdit || isPending}>
            Edit
          </button>
        ) : (
          <>
            <button type="button" className="btn-base btn-light" onClick={cancelEditing} disabled={isPending}>
              Cancel
            </button>
            <button type="button" className="btn-base btn-dark" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type MatchStatus = 'scheduled' | 'delayed' | 'live' | 'finished' | 'cancelled'

type Prediction = {
  home: number
  away: number
}

type LivePrediction = {
  username: string
  homeScore: number
  awayScore: number
  points?: number
}

export type BasicMatch = {
  id: string
  homeTeam: string
  homeLogo?: string | null
  awayTeam: string
  awayLogo?: string | null
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

const MAX_PREDICTED_GOALS = 20

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
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [savedPrediction, setSavedPrediction] = useState<Prediction | null>(match.prediction)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showBets, setShowBets] = useState(false)

  useEffect(() => {
    if (!saveMessage) {
      return
    }

    const timer = window.setTimeout(() => {
      setSaveMessage(null)
    }, 1500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [saveMessage])

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
  const increaseHome = () => setHomeScore((prev) => Math.min(MAX_PREDICTED_GOALS, prev + 1))

  const decreaseAway = () => setAwayScore((prev) => Math.max(0, prev - 1))
  const increaseAway = () => setAwayScore((prev) => Math.min(MAX_PREDICTED_GOALS, prev + 1))

  const startEditing = () => {
    if (!canEdit) return
    setError(null)
    setSaveMessage(null)
    setIsEditing(true)
    setHomeScore(0)
    setAwayScore(0)
  }

  const cancelEditing = () => {
    setError(null)
    setSaveMessage(null)
    setIsEditing(false)
  }

  const handleSave = () => {
    setError(null)
    setSaveMessage(null)

    const optimisticPrediction = { home: homeScore, away: awayScore }
    const previousPrediction = savedPrediction

    // Optimistic update: show the new score immediately in the card.
    setSavedPrediction(optimisticPrediction)
    setIsEditing(false)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/bets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: match.id, homeScore, awayScore }),
        })

        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          bet?: { homeScore: number; awayScore: number }
        }

        if (!response.ok || !data.bet) {
          throw new Error(data.error || 'Could not save bet.')
        }

        setSavedPrediction({ home: data.bet.homeScore, away: data.bet.awayScore })
        setSaveMessage('Saved.')
        router.refresh()
      } catch (saveError) {
        setSavedPrediction(previousPrediction)
        setHomeScore(optimisticPrediction.home)
        setAwayScore(optimisticPrediction.away)
        setIsEditing(true)
        setError(saveError instanceof Error ? saveError.message : 'Could not save bet.')
      }
    })
  }

  const showOfficialScore =
    (match.status === 'live' || match.status === 'finished') &&
    typeof match.liveScore?.home === 'number' &&
    typeof match.liveScore?.away === 'number'

  const showPlayerPredictionInCenter = !isStarted && !isEditing && savedPrediction

  return (
    <div className="border-2 border-zinc-300 bg-white/90 p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <div />
        <p className="text-center text-sm text-text-muted">
          {new Date(match.startTime).toLocaleString('pl-PL', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
        <div className="flex justify-end">
          <span className={`px-2.5 py-1 text-xs font-semibold ${statusClassName}`}>
            {getStatusLabel(match.status)}
          </span>
        </div>
      </div>

      {match.status === 'live' ? (
        <div className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold text-[#4CAF50]">
          <span className="inline-block h-2 w-2 bg-[#4CAF50]" />
          <span>LIVE{typeof match.liveMinute === 'number' ? ` ${match.liveMinute}'` : ''}</span>
        </div>
      ) : null}

      <div className="flex flex-nowrap items-center justify-between gap-3 py-1">
        <div className="w-[38%] min-w-0 flex flex-col items-center text-center">
          {match.homeLogo ? (
            <img src={match.homeLogo} alt="" aria-hidden="true" className="mb-2 h-12 w-12 object-contain" />
          ) : (
            <div className="mb-2 h-12 w-12" />
          )}
          <p className="text-sm font-semibold text-text-main">{match.homeTeam}</p>
        </div>

        <div className="w-[24%] min-w-[120px] text-center">
          {!isEditing ? (
            <div className="font-mono text-3xl font-bold text-text-main">
              {showOfficialScore ? (
                <span>
                  {match.liveScore?.home} : {match.liveScore?.away}
                </span>
              ) : showPlayerPredictionInCenter ? (
                <span>
                  {savedPrediction.home} : {savedPrediction.away}
                </span>
              ) : (
                <span>-</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-[40px_auto_40px] items-center gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  className="h-7 w-7 border-2 border-brand bg-brand text-base font-bold leading-none text-white transition-colors hover:border-brand-soft hover:bg-brand-soft disabled:opacity-60"
                  onClick={increaseHome}
                  disabled={isPending || homeScore >= MAX_PREDICTED_GOALS}
                >
                  +
                </button>
                <span className="w-8 text-center font-mono text-3xl font-bold text-text-main">{homeScore}</span>
                <button
                  type="button"
                  className="h-7 w-7 border-2 border-zinc-300 bg-white text-base font-bold leading-none text-text-main transition-colors hover:border-zinc-400 disabled:opacity-60"
                  onClick={decreaseHome}
                  disabled={isPending || homeScore <= 0}
                >
                  -
                </button>
              </div>

              <div className="text-2xl font-bold text-text-main">:</div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  className="h-7 w-7 border-2 border-brand bg-brand text-base font-bold leading-none text-white transition-colors hover:border-brand-soft hover:bg-brand-soft disabled:opacity-60"
                  onClick={increaseAway}
                  disabled={isPending || awayScore >= MAX_PREDICTED_GOALS}
                >
                  +
                </button>
                <span className="w-8 text-center font-mono text-3xl font-bold text-text-main">{awayScore}</span>
                <button
                  type="button"
                  className="h-7 w-7 border-2 border-zinc-300 bg-white text-base font-bold leading-none text-text-main transition-colors hover:border-zinc-400 disabled:opacity-60"
                  onClick={decreaseAway}
                  disabled={isPending || awayScore <= 0}
                >
                  -
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-[38%] min-w-0 flex flex-col items-center text-center">
          {match.awayLogo ? (
            <img src={match.awayLogo} alt="" aria-hidden="true" className="mb-2 h-12 w-12 object-contain" />
          ) : (
            <div className="mb-2 h-12 w-12" />
          )}
          <p className="text-sm font-semibold text-text-main">{match.awayTeam}</p>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-[#F97316]">{error}</p> : null}

      {canEdit ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span
            aria-live="polite"
            className={`min-w-[56px] text-sm text-green-700 transition-opacity ${saveMessage ? 'opacity-100' : 'opacity-0'}`}
          >
            {saveMessage ?? 'Saved.'}
          </span>

          <div className="flex items-center justify-end gap-3">
            {!isEditing ? (
              <button
                type="button"
                className="border-2 border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-text-main transition-colors hover:border-brand hover:text-brand"
                onClick={startEditing}
                disabled={isPending}
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-text-main transition-colors hover:border-brand hover:text-brand"
                  onClick={cancelEditing}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="border-2 border-brand bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-soft hover:bg-brand-soft"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  {isPending ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Collapsible other players' bets */}
      {livePredictions.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowBets((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 border-t-2 border-zinc-200 pt-3 text-sm font-medium text-text-muted hover:text-text-main"
          >
            <span>Players bets ({livePredictions.length})</span>
            <span className={`text-xs transition-transform duration-200 ${showBets ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showBets ? (
            <ul className="mt-2 space-y-1">
              {livePredictions.map((item) => (
                <li key={`${item.username}-${item.homeScore}-${item.awayScore}`} className="flex items-center justify-between text-sm text-text-main">
                  <span>{item.username}</span>
                  <span className="flex items-center gap-3 font-semibold">
                    <span>{item.homeScore} : {item.awayScore}</span>
                    {typeof item.points === 'number' ? (
                      <span className="font-bold text-brand">{item.points} pts</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
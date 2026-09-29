'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, LoaderCircle, Minus, Pencil, Plus } from 'lucide-react'
import TickNumber from '@/app/components/motion/TickNumber'
import { useSmoothHeight } from '@/app/components/motion/useLayoutMotion'

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

// Score steppers: 40px visual, 44px+ hit area via .touch-target.
const STEP_BASE =
  'touch-target inline-flex h-10 w-10 items-center justify-center border-2 transition-colors disabled:opacity-40'
const STEP_UP = `${STEP_BASE} border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:hover:border-brand disabled:hover:bg-brand`
const STEP_DOWN = `${STEP_BASE} border-zinc-300 bg-white text-text-main hover:border-zinc-500 active:bg-zinc-100 disabled:hover:border-zinc-300`
const SECONDARY_ACTION =
  'inline-flex min-h-11 items-center justify-center gap-2 border-2 border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-text-main transition-colors hover:border-brand hover:text-brand active:bg-brand-tint disabled:opacity-60'

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
  const cardRef = useRef<HTMLDivElement>(null)
  // True once the user has toggled edit mode: from then on the swapped-in
  // score / buttons fade in. Never true on first render or data refreshes.
  const [hasToggled, setHasToggled] = useState(false)
  const swapIn = hasToggled ? 'animate-message-in' : ''

  // Score <-> steppers changes the card's height: glide instead of jumping.
  useSmoothHeight(cardRef, isEditing)

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

  const isStarted = match.status === 'live' || match.status === 'finished' || match.status === 'cancelled' || new Date(match.startTime).getTime() <= Date.now()
  const isRoomActive = roomStatus === 'active'
  const canEdit = isRoomActive && !isStarted

  const statusClassName = useMemo(() => {
    if (match.status === 'live') return 'bg-green-100 text-green-900'
    if (match.status === 'finished') return 'bg-zinc-200/70 text-zinc-700'
    if (match.status === 'delayed') return 'bg-orange-100 text-orange-900'
    return 'bg-blue-100 text-blue-900'
  }, [match.status])

  const decreaseHome = () => setHomeScore((prev) => Math.max(0, prev - 1))
  const increaseHome = () => setHomeScore((prev) => Math.min(MAX_PREDICTED_GOALS, prev + 1))

  const decreaseAway = () => setAwayScore((prev) => Math.max(0, prev - 1))
  const increaseAway = () => setAwayScore((prev) => Math.min(MAX_PREDICTED_GOALS, prev + 1))

  const startEditing = () => {
    if (!canEdit) return
    setError(null)
    setSaveMessage(null)
    setHasToggled(true)
    setIsEditing(true)
    setHomeScore(0)
    setAwayScore(0)
  }

  const cancelEditing = () => {
    setHasToggled(true)
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
    setHasToggled(true)
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
  // The transition stays pending through the follow-up refresh; once the save
  // is confirmed, "Saved." takes over from "Saving…".
  const isSaving = isPending && !saveMessage

  return (
    <div ref={cardRef} className="border-2 border-zinc-300 bg-white/90 p-4 sm:p-5">
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div />
        <p className="text-center text-sm tabular-nums text-zinc-600">
          {new Date(match.startTime).toLocaleString('pl-PL', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
        <div className="flex justify-end">
          <span className={`status-chip ${statusClassName}`}>
            {getStatusLabel(match.status)}
          </span>
        </div>
      </div>

      {match.status === 'live' ? (
        <div className="mb-3 flex items-center justify-center gap-2 text-sm font-bold tabular-nums text-brand">
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-bright opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          <span>LIVE{typeof match.liveMinute === 'number' ? ` ${match.liveMinute}'` : ''}</span>
        </div>
      ) : null}

      <div className="flex flex-nowrap items-center justify-between gap-2 py-1 sm:gap-3">
        <div className="flex w-[38%] min-w-0 flex-col items-center text-center">
          {match.homeLogo ? (
            <img src={match.homeLogo} alt="" aria-hidden="true" loading="lazy" decoding="async" className="mb-2 h-12 w-12 object-contain" />
          ) : (
            <div aria-hidden="true" className="mb-2 h-12 w-12 rounded-full bg-zinc-100" />
          )}
          <p className="text-sm font-bold leading-snug text-text-main">{match.homeTeam}</p>
        </div>

        <div className="w-[24%] min-w-[112px] text-center">
          {!isEditing ? (
            <div key="score" className={`flex flex-col items-center ${swapIn}`}>
              <div className="text-4xl font-black leading-none tracking-tight tabular-nums text-text-main">
                {showOfficialScore ? (
                  <span>
                    <TickNumber value={match.liveScore?.home ?? 0} />
                    <span className="mx-1.5 text-zinc-400">:</span>
                    <TickNumber value={match.liveScore?.away ?? 0} />
                  </span>
                ) : showPlayerPredictionInCenter ? (
                  <span>
                    <TickNumber value={savedPrediction.home} />
                    <span className="mx-1.5 text-zinc-400">:</span>
                    <TickNumber value={savedPrediction.away} />
                  </span>
                ) : (
                  <span className="text-zinc-300" aria-label="No score yet">
                    –<span className="mx-1.5">:</span>–
                  </span>
                )}
              </div>
              {!showOfficialScore && showPlayerPredictionInCenter ? (
                <span className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-600">Your pick</span>
              ) : null}
            </div>
          ) : (
            <div key="steppers" className="animate-message-in grid grid-cols-[40px_auto_40px] items-center justify-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Increase ${match.homeTeam} score`}
                  className={STEP_UP}
                  onClick={increaseHome}
                  disabled={isPending || homeScore >= MAX_PREDICTED_GOALS}
                >
                  <Plus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
                <span aria-live="polite" className="w-10 overflow-hidden text-center text-3xl font-black leading-none tabular-nums text-text-main"><TickNumber value={homeScore} /></span>
                <button
                  type="button"
                  aria-label={`Decrease ${match.homeTeam} score`}
                  className={STEP_DOWN}
                  onClick={decreaseHome}
                  disabled={isPending || homeScore <= 0}
                >
                  <Minus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>

              <div aria-hidden="true" className="text-2xl font-black text-zinc-400">:</div>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Increase ${match.awayTeam} score`}
                  className={STEP_UP}
                  onClick={increaseAway}
                  disabled={isPending || awayScore >= MAX_PREDICTED_GOALS}
                >
                  <Plus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
                <span aria-live="polite" className="w-10 overflow-hidden text-center text-3xl font-black leading-none tabular-nums text-text-main"><TickNumber value={awayScore} /></span>
                <button
                  type="button"
                  aria-label={`Decrease ${match.awayTeam} score`}
                  className={STEP_DOWN}
                  onClick={decreaseAway}
                  disabled={isPending || awayScore <= 0}
                >
                  <Minus size={18} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex w-[38%] min-w-0 flex-col items-center text-center">
          {match.awayLogo ? (
            <img src={match.awayLogo} alt="" aria-hidden="true" loading="lazy" decoding="async" className="mb-2 h-12 w-12 object-contain" />
          ) : (
            <div aria-hidden="true" className="mb-2 h-12 w-12 rounded-full bg-zinc-100" />
          )}
          <p className="text-sm font-bold leading-snug text-text-main">{match.awayTeam}</p>
        </div>
      </div>

      {error ? <p role="alert" className="animate-message-in mt-3 text-center text-sm font-medium text-danger">{error}</p> : null}

      {canEdit ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4">
          {/* Save status: "Saving…" while the request runs, then "Saved." with a
              check. Both sit in one grid cell so they crossfade without shifting. */}
          <span aria-live="polite" className="grid min-w-[80px] text-sm font-semibold">
            <span
              className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 text-zinc-600 transition-[opacity,translate] duration-150 ${
                isSaving ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
              }`}
            >
              <LoaderCircle size={15} strokeWidth={2.5} aria-hidden="true" className="motion-safe:animate-spin" />
              {isSaving ? 'Saving…' : null}
            </span>
            <span
              className={`col-start-1 row-start-1 inline-flex items-center gap-1 text-brand transition-[opacity,translate] duration-[220ms] ${
                saveMessage ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
              }`}
            >
              <Check key={saveMessage ?? 'idle'} size={16} strokeWidth={3} aria-hidden="true" className={saveMessage ? 'animate-check-in' : ''} />
              {saveMessage ?? 'Saved.'}
            </span>
          </span>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            {!isEditing ? (
              <button
                key="edit"
                type="button"
                className={`${SECONDARY_ACTION} ${swapIn}`}
                onClick={startEditing}
                disabled={isPending}
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
              </button>
            ) : (
              <>
                <button
                  key="cancel"
                  type="button"
                  className={`${SECONDARY_ACTION} animate-message-in`}
                  onClick={cancelEditing}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  key="save"
                  type="button"
                  className="animate-message-in inline-flex min-h-11 items-center justify-center gap-2 border-2 border-brand bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:opacity-60"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Collapsible other players' bets */}
      {livePredictions.length > 0 ? (
        <div className="mt-4 border-t-2 border-zinc-200">
          <button
            type="button"
            onClick={() => setShowBets((prev) => !prev)}
            aria-expanded={showBets}
            className="no-press flex min-h-11 w-full items-center justify-between gap-2 pt-1 text-sm font-semibold text-zinc-700 transition-colors hover:text-text-main active:text-brand"
          >
            <span>
              Players bets <span className="tabular-nums text-zinc-500">({livePredictions.length})</span>
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`text-zinc-500 transition-transform duration-[220ms] ${showBets ? 'rotate-180' : ''}`}
            />
          </button>
          <div className="collapsible" data-open={showBets}>
            <ul className="divide-y divide-zinc-100">
              {livePredictions.map((item) => (
                <li key={`${item.username}-${item.homeScore}-${item.awayScore}`} className="flex items-center justify-between gap-3 py-2 text-sm text-text-main">
                  <span className="min-w-0 truncate">{item.username}</span>
                  <span className="flex shrink-0 items-center gap-2 font-semibold tabular-nums">
                    <span className="w-12 text-center">{item.homeScore} : {item.awayScore}</span>
                    {typeof item.points === 'number' ? (
                      <span className={`w-14 text-right font-bold ${item.points > 0 ? 'text-brand' : 'text-zinc-500'}`}>{item.points} pts</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}

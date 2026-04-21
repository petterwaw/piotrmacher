'use client'

import { type MatchStatus } from '@/app/data/matches.mock'
import { getMockPrediction, saveMockPrediction, type Prediction } from '@/app/utils/bets/mockPredictionStore'
import { useEffect, useMemo, useState } from 'react'

export type BasicMatch = {
  id: string
  homeTeam: string
  awayTeam: string
  startTime: string
  status: MatchStatus
  prediction: Prediction | null
}

type ScorePredictionCardProps = {
  match: BasicMatch
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
  return 'Finished'
}

export default function ScorePredictionCard({ match, roomStatus = 'waiting' }: ScorePredictionCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [savedPrediction, setSavedPrediction] = useState<Prediction | null>(match.prediction)

  const isStarted = match.status === 'live' || match.status === 'finished'
  const isRoomActive = roomStatus === 'active'
  const canEdit = isRoomActive && !isStarted

  const statusClassName = useMemo(() => {
    if (match.status === 'live') return 'bg-green-100 text-green-800'
    if (match.status === 'finished') return 'bg-gray-100 text-gray-700'
    if (match.status === 'delayed') return 'bg-orange-100 text-orange-800'
    return 'bg-blue-100 text-blue-800'
  }, [match.status])

  useEffect(() => {
    const storedPrediction = getMockPrediction(match.id)
    if (storedPrediction) {
      setSavedPrediction(storedPrediction)
    }
  }, [match.id])

  const decreaseHome = () => setHomeScore((prev) => Math.max(0, prev - 1))
  const increaseHome = () => setHomeScore((prev) => prev + 1)

  const decreaseAway = () => setAwayScore((prev) => Math.max(0, prev - 1))
  const increaseAway = () => setAwayScore((prev) => prev + 1)

  const startEditing = () => {
    if (!canEdit) {
      return
    }

    setIsEditing(true)
    setHomeScore(0)
    setAwayScore(0)
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const handleSave = () => {
    const nextPrediction = saveMockPrediction(match.id, {
      home: homeScore,
      away: awayScore,
    })

    setSavedPrediction(nextPrediction)
    setIsEditing(false)
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
        <div className="mb-4 text-center text-base font-semibold text-text-main sm:text-lg">
          {match.homeTeam} - {match.awayTeam}
        </div>

        {!isEditing ? (
          <div className="flex min-h-14 items-center justify-center">
            {savedPrediction ? (
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

      <div className="mt-5 flex items-center justify-end gap-3">
        {!isEditing ? (
          <button type="button" className="btn-base btn-light" onClick={startEditing} disabled={!canEdit}>
            Edit
          </button>
        ) : (
          <>
            <button type="button" className="btn-base btn-light" onClick={cancelEditing}>
              Cancel
            </button>
            <button type="button" className="btn-base btn-dark" onClick={handleSave}>
              Save
            </button>
          </>
        )}
      </div>
    </div>
  )
}
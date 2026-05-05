'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

type Rules = {
  correct_winner: number
  correct_difference: number
  correct_away_goals: number
  correct_home_goals: number
  exact_score: number
  exact_draw: number
}

const ruleLabels: Array<{ key: Exclude<keyof Rules, 'correct_away_goals' | 'correct_home_goals'>; label: string }> = [
  { key: 'correct_winner', label: 'Correct winner' },
  { key: 'correct_difference', label: 'Correct difference' },
  { key: 'exact_score', label: 'Exact score' },
  { key: 'exact_draw', label: 'Exact draw' },
]

type Props = {
  roomId: string
  initialStatus: 'waiting' | 'active' | 'finished'
  initialEventId: string
  initialRoomEndAt: string | null
  inviteCode: string
  events: Array<{ id: string; name: string; season: string; displayName: string }>
  initialRules: Rules
}

export default function SettingsPanel({
  roomId,
  initialStatus,
  initialEventId,
  initialRoomEndAt,
  inviteCode,
  events,
  initialRules,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [eventId, setEventId] = useState(initialEventId)
  const [endMode, setEndMode] = useState<'full_event' | 'set_end_date'>(
    initialRoomEndAt ? 'set_end_date' : 'full_event'
  )
  const [roomEndAt, setRoomEndAt] = useState(() => {
    if (!initialRoomEndAt) return ''
    const date = new Date(initialRoomEndAt)
    if (Number.isNaN(date.getTime())) return ''
    const offsetMs = date.getTimezoneOffset() * 60 * 1000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  })
  const [rules, setRules] = useState<Rules>(initialRules)
  const [teamGoalsPoints, setTeamGoalsPoints] = useState(() =>
    Math.max(initialRules.correct_home_goals, initialRules.correct_away_goals)
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isWaiting = status === 'waiting'

  const statusBadgeClass = useMemo(() => {
    if (status === 'active') return 'bg-green-100 text-green-800'
    if (status === 'finished') return 'bg-gray-100 text-gray-700'
    return 'bg-yellow-100 text-yellow-800'
  }, [status])

  const handleRuleChange = (key: keyof Rules, value: string) => {
    const parsed = Number(value)
    setRules((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0,
    }))
  }

  const saveSettings = () => {
    setError(null)
    setMessage(null)

    const normalizedRules: Rules = {
      ...rules,
      correct_home_goals: teamGoalsPoints,
      correct_away_goals: teamGoalsPoints,
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId,
            rules: normalizedRules,
            roomEndAt: endMode === 'set_end_date' ? roomEndAt || null : null,
          }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not save settings.')
        }

        setMessage('Settings saved.')
        router.refresh()
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save settings.')
      }
    })
  }

  const startRoom = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'start' }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not start room.')
        }

        setStatus('active')
        setMessage('Room started. Betting is now enabled.')
        router.refresh()
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : 'Could not start room.')
      }
    })
  }

  const copyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setError('Could not copy invite code.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border-2 border-zinc-300 bg-white/90 p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
        <p className="text-sm font-medium text-text-main">Invite code</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="bg-white px-3 py-2 font-mono text-sm text-text-main border-2 border-zinc-300">
            {inviteCode}
          </span>
          <button type="button" className="btn-base btn-light rounded-none" onClick={copyInviteCode}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="border-2 border-zinc-300 bg-white/90 p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
        <label className="mb-2 block text-sm font-medium text-text-main" htmlFor="settings-event">
          Event
        </label>
        <select
          id="settings-event"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          disabled={!isWaiting || isPending}
          className="w-full border-2 border-zinc-300 bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-[#66BB6A] disabled:bg-gray-100"
        >
          {events.map((eventOption) => (
            <option key={eventOption.id} value={eventOption.id}>
              {eventOption.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="border-2 border-zinc-300 bg-white/90 p-5 transition-all duration-200 hover:border-brand hover:shadow-md space-y-2">
        <p className="text-sm font-medium text-text-main">Room duration</p>
        <label className="flex items-center gap-2 text-sm text-text-main">
          <input
            type="radio"
            name="room-duration-settings"
            value="full_event"
            checked={endMode === 'full_event'}
            onChange={() => setEndMode('full_event')}
            disabled={!isWaiting || isPending}
          />
          <span>Full event</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-main">
          <input
            type="radio"
            name="room-duration-settings"
            value="set_end_date"
            checked={endMode === 'set_end_date'}
            onChange={() => setEndMode('set_end_date')}
            disabled={!isWaiting || isPending}
          />
          <span>Set end date</span>
        </label>

        {endMode === 'set_end_date' ? (
          <>
            <label className="mb-2 mt-2 block text-sm font-medium text-text-main" htmlFor="settings-room-end-at">
              End date
            </label>
            <input
              id="settings-room-end-at"
              type="datetime-local"
              value={roomEndAt}
              onChange={(event) => setRoomEndAt(event.target.value)}
              disabled={!isWaiting || isPending}
              className="w-full border-2 border-zinc-300 bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-[#66BB6A] disabled:bg-gray-100"
            />
          </>
        ) : null}
      </div>

      <div className="border-2 border-zinc-300 bg-white/90 p-5 transition-all duration-200 hover:border-brand hover:shadow-md">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ruleLabels.map((rule) => (
          <label key={rule.key} className="text-sm text-text-main">
            <span className="mb-1 block font-medium">{rule.label}</span>
            <input
              type="number"
              min={0}
              value={rules[rule.key]}
              onChange={(event) => handleRuleChange(rule.key, event.target.value)}
              disabled={!isWaiting || isPending}
              className="w-full border-2 border-zinc-300 bg-white px-3 py-2 outline-none transition-colors focus:border-[#66BB6A] disabled:bg-gray-100"
            />
          </label>
        ))}

        <label className="text-sm text-text-main">
          <span className="mb-1 block font-medium">Correct team goals</span>
          <input
            type="number"
            min={0}
            value={teamGoalsPoints}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              setTeamGoalsPoints(Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0)
            }}
            disabled={!isWaiting || isPending}
            className="w-full border-2 border-zinc-300 bg-white px-3 py-2 outline-none transition-colors focus:border-[#66BB6A] disabled:bg-gray-100"
          />
          <p className="mt-1 text-xs text-text-muted">Applies to both home goals and away goals.</p>
        </label>
      </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="btn-base btn-light rounded-none"
          onClick={saveSettings}
          disabled={!isWaiting || isPending}
        >
          Save settings
        </button>
        <button
          type="button"
          className="btn-base btn-dark rounded-none"
          onClick={startRoom}
          disabled={!isWaiting || isPending}
        >
          Start room
        </button>
      </div>

      {!isWaiting ? (
        <p className="text-sm text-text-muted">
          Room is already started. Event and rules are locked.
        </p>
      ) : null}

      {error ? <p className="text-sm text-[#F97316]">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </div>
  )
}

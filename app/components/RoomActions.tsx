'use client'

import { createRoom } from '@/app/utils/rooms/createRoom'
import { joinRoom } from '@/app/utils/rooms/joinRoom'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

type ModalMode = 'create' | 'join' | null

type ApiResponse = {
  error?: string
  roomId?: string
}

type EventOption = {
  id: string
  name: string
  season: string
  displayName: string
}

async function parseResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as ApiResponse

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.')
  }

  return data
}

const modalCopy = {
  create: {
    title: 'Create room',
    description: 'Give the room a name and create it instantly.',
    label: 'Room name',
    placeholder: 'Premier League Weekend',
    action: 'Create room',
  },
  join: {
    title: 'Join room',
    description: 'Paste the invite code you received from the host.',
    label: 'Invite code',
    placeholder: 'ab12cd34',
    action: 'Join room',
  },
} as const

export default function RoomActions() {
  const router = useRouter()
  const [mode, setMode] = useState<ModalMode>(null)
  const [value, setValue] = useState('')
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (mode !== 'create') {
      return
    }

    let isCancelled = false
    setEventsLoading(true)

    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events')
        const data = (await response.json().catch(() => ({ events: [] }))) as {
          events?: EventOption[]
        }

        if (!response.ok) {
          throw new Error('Could not load events')
        }

        if (!isCancelled) {
          const nextEvents = data.events ?? []
          setEvents(nextEvents)
          setEventId((current) => current || nextEvents[0]?.id || '')
        }
      } catch {
        if (!isCancelled) {
          setEvents([])
        }
      } finally {
        if (!isCancelled) {
          setEventsLoading(false)
        }
      }
    }

    fetchEvents()

    return () => {
      isCancelled = true
    }
  }, [mode])

  useEffect(() => {
    if (!mode) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        setMode(null)
        setError(null)
        setValue('')
        setEventId('')
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isPending, mode])

  const openModal = (nextMode: Exclude<ModalMode, null>) => {
    setMode(nextMode)
    setValue('')
    setEventId('')
    setError(null)
  }

  const closeModal = () => {
    if (isPending) {
      return
    }

    setMode(null)
    setValue('')
    setEventId('')
    setError(null)
  }

  const handleSubmit = () => {
    if (!mode) {
      return
    }

    const trimmedValue = value.trim()

    if (mode === 'create' && trimmedValue.length < 3) {
      setError('Room name must be at least 3 characters long.')
      return
    }

    if (mode === 'create' && !eventId) {
      setError('Select event for this room.')
      return
    }

    if (mode === 'join' && trimmedValue.length < 4) {
      setError('Enter a valid invite code.')
      return
    }

    setError(null)

    startTransition(async () => {
      try {
        const response =
          mode === 'create'
            ? await createRoom({ name: trimmedValue, eventId })
            : await joinRoom({ code: trimmedValue })

        const data = await parseResponse(response)

        if (!data.roomId) {
          throw new Error('Room was not returned by the server.')
        }

        setMode(null)
        setValue('')
        setEventId('')
        setError(null)
        router.push(`/home/${data.roomId}`)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : 'Something went wrong. Try again.'
        )
      }
    })
  }

  const copy = mode ? modalCopy[mode] : null

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-4">
        <button type="button" className="btn-base btn-dark" onClick={() => openModal('create')}>
          New room
        </button>
        <button type="button" className="btn-base btn-light" onClick={() => openModal('join')}>
          Join with a code
        </button>
      </div>

      {mode && copy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-border-soft bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-text-main">{copy.title}</h2>
                <p className="mt-1 text-sm text-text-muted">{copy.description}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-border-soft px-3 py-1 text-sm text-text-muted transition-colors hover:border-brand-soft hover:text-text-main"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-main" htmlFor="room-modal-input">
                {copy.label}
              </label>
              <input
                id="room-modal-input"
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={copy.placeholder}
                className="w-full rounded-xl border border-border-soft bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-brand"
                disabled={isPending}
                maxLength={mode === 'create' ? 60 : 32}
                autoFocus
              />

              {mode === 'create' ? (
                <>
                  <label className="mt-3 block text-sm font-medium text-text-main" htmlFor="room-modal-event">
                    Event
                  </label>
                  <select
                    id="room-modal-event"
                    value={eventId}
                    onChange={(event) => setEventId(event.target.value)}
                    className="w-full rounded-xl border border-border-soft bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-brand"
                    disabled={isPending || eventsLoading || events.length === 0}
                  >
                    {events.length === 0 ? (
                      <option value="">No events available</option>
                    ) : null}
                    {events.map((eventOption) => (
                      <option key={eventOption.id} value={eventOption.id}>
                        {eventOption.displayName}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-base btn-light" onClick={closeModal} disabled={isPending}>
                Cancel
              </button>
              <button type="button" className="btn-base btn-dark" onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Working...' : copy.action}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

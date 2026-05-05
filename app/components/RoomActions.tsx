'use client'

import { createRoom } from '@/app/utils/rooms/createRoom'
import { joinRoom } from '@/app/utils/rooms/joinRoom'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

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
  const desktopActionsRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<ModalMode>(null)
  const [value, setValue] = useState('')
  const [eventId, setEventId] = useState('')
  const [roomEndAt, setRoomEndAt] = useState('')
  const [endMode, setEndMode] = useState<'full_event' | 'set_end_date'>('full_event')
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDesktopActionsOpen, setIsDesktopActionsOpen] = useState(false)
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
        setRoomEndAt('')
        setEndMode('full_event')
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isPending, mode])

  useEffect(() => {
    if (!isDesktopActionsOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (desktopActionsRef.current?.contains(target)) {
        return
      }

      setIsDesktopActionsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isDesktopActionsOpen])

  const openModal = (nextMode: Exclude<ModalMode, null>) => {
    setIsDesktopActionsOpen(false)
    setMode(nextMode)
    setValue('')
    setEventId('')
    setRoomEndAt('')
    setEndMode('full_event')
    setError(null)
  }

  const closeModal = () => {
    if (isPending) {
      return
    }

    setMode(null)
    setValue('')
    setEventId('')
    setRoomEndAt('')
    setEndMode('full_event')
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
            ? await createRoom({
                name: trimmedValue,
                eventId,
                roomEndAt: endMode === 'set_end_date' ? roomEndAt || null : null,
              })
            : await joinRoom({ code: trimmedValue })

        const data = await parseResponse(response)

        if (!data.roomId) {
          throw new Error('Room was not returned by the server.')
        }

        setMode(null)
        setValue('')
        setEventId('')
        setRoomEndAt('')
        setEndMode('full_event')
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
      {/* Mobile and tablet: full-width top actions */}
      <div className="mb-4 flex flex-col gap-3 sm:col-span-2 sm:flex-row lg:hidden">
        <button
          type="button"
          className="w-full border border-zinc-300 bg-white px-4 py-3 font-bold uppercase tracking-wide text-text-main transition-colors hover:border-brand hover:bg-gray-50 sm:w-[220px]"
          onClick={() => openModal('create')}
        >
          Create a room
        </button>
        <button
          type="button"
          className="w-full border border-brand bg-brand px-4 py-3 font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-soft hover:border-brand-soft sm:w-[220px]"
          onClick={() => openModal('join')}
        >
          Join a room
        </button>
      </div>

      {/* Desktop: Kafelek with plus icon and hover reveal */}
      <div
        ref={desktopActionsRef}
        className="group relative hidden min-h-[228px] border-2 border-zinc-300 bg-white/90 shadow-sm transition-all duration-200 hover:border-brand hover:shadow-md lg:flex lg:flex-col lg:items-center lg:justify-center"
        onClick={() => setIsDesktopActionsOpen((current) => !current)}
        onMouseLeave={() => setIsDesktopActionsOpen(false)}
      >
        <div className="text-[72px] font-black leading-none text-zinc-300 transition-colors duration-200 group-hover:text-brand">
          +
        </div>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">New Action</p>

        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/92 transition-opacity duration-200 ${
            isDesktopActionsOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
          }`}
        >
          <button
            type="button"
            className="inline-flex min-w-[170px] items-center justify-center border border-zinc-300 bg-white px-4 py-2 text-sm font-bold uppercase tracking-wide text-text-main transition-colors hover:border-brand hover:bg-gray-50"
            onClick={(event) => {
              event.stopPropagation()
              openModal('create')
            }}
          >
            Create a room
          </button>
          <button
            type="button"
            className="inline-flex min-w-[170px] items-center justify-center border border-brand bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-soft hover:border-brand-soft"
            onClick={(event) => {
              event.stopPropagation()
              openModal('join')
            }}
          >
            Join a room
          </button>
        </div>
      </div>

      {mode && copy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-md border-2 border-zinc-300 bg-white/90 p-6 shadow-md">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-text-main">{copy.title}</h2>
                <p className="mt-1 text-sm text-text-muted">{copy.description}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="border-2 border-zinc-300 bg-white px-3 py-1 text-sm text-text-muted transition-colors hover:border-brand hover:text-text-main"
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
                className="w-full border-2 border-zinc-300 bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-[#66BB6A]"
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
                    className="w-full border-2 border-zinc-300 bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-[#66BB6A]"
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

                  <fieldset className="mt-3 space-y-2">
                    <legend className="block text-sm font-medium text-text-main">Room duration</legend>
                    <label className="flex items-center gap-2 text-sm text-text-main">
                      <input
                        type="radio"
                        name="room-duration-create"
                        value="full_event"
                        checked={endMode === 'full_event'}
                        onChange={() => setEndMode('full_event')}
                        disabled={isPending}
                      />
                      <span>Full event</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-main">
                      <input
                        type="radio"
                        name="room-duration-create"
                        value="set_end_date"
                        checked={endMode === 'set_end_date'}
                        onChange={() => setEndMode('set_end_date')}
                        disabled={isPending}
                      />
                      <span>Set end date</span>
                    </label>
                  </fieldset>

                  {endMode === 'set_end_date' ? (
                    <>
                      <label className="mt-2 block text-sm font-medium text-text-main" htmlFor="room-modal-end-at">
                        End date
                      </label>
                      <input
                        id="room-modal-end-at"
                        type="datetime-local"
                        value={roomEndAt}
                        onChange={(event) => setRoomEndAt(event.target.value)}
                        className="w-full border-2 border-zinc-300 bg-white px-4 py-3 text-text-main outline-none transition-colors focus:border-[#66BB6A]"
                        disabled={isPending}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </div>

            {error ? <p className="mt-3 text-sm text-[#F97316]">{error}</p> : null}

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

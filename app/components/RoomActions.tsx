'use client'

import { createRoom } from '@/app/utils/rooms/createRoom'
import { joinRoom } from '@/app/utils/rooms/joinRoom'
import EventSelect from '@/app/components/EventSelect'
import DatePicker from '@/app/components/DatePicker'
import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { usePresence } from '@/app/components/motion/usePresence'
import { useDialogFocus } from '@/app/components/a11y/useDialogFocus'

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
  const dialogRef = useRef<HTMLDivElement | null>(null)
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

  const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!mode || isPending) {
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

  // Keep the modal mounted for its exit animation after `mode` clears.
  const { value: shownMode, isClosing } = usePresence(mode)
  // Focus trap + focus return (Escape is handled above).
  useDialogFocus(dialogRef, Boolean(mode))
  const copy = shownMode ? modalCopy[shownMode] : null

  return (
    <>
      {/* Mobile and tablet: full-width top actions */}
      <div className="mb-4 flex flex-col gap-3 sm:col-span-2 sm:flex-row lg:hidden">
        <button
          type="button"
          className="press-soft min-h-12 w-full border-2 border-zinc-300 bg-white px-4 py-3 font-bold uppercase tracking-wide text-text-main transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand active:bg-brand-tint sm:w-[220px]"
          onClick={() => openModal('create')}
        >
          Create a room
        </button>
        <button
          type="button"
          className="press-soft min-h-12 w-full border-2 border-brand bg-brand px-4 py-3 font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover hover:border-brand-hover active:bg-brand-hover sm:w-[220px]"
          onClick={() => openModal('join')}
        >
          Join a room
        </button>
      </div>

      {/* Desktop: Kafelek with plus icon and hover reveal */}
      <div
        ref={desktopActionsRef}
        className="group relative hidden min-h-[228px] border-2 border-dashed border-zinc-300 bg-white/60 transition-[border-color,background-color] duration-200 hover:border-solid hover:border-brand hover:bg-white/90 focus-within:border-solid focus-within:border-brand lg:flex lg:flex-col lg:items-center lg:justify-center"
        onClick={() => setIsDesktopActionsOpen((current) => !current)}
        onMouseLeave={() => setIsDesktopActionsOpen(false)}
      >
        <Plus size={56} strokeWidth={2.5} aria-hidden="true" className="text-zinc-300 transition-colors duration-200 group-hover:text-brand" />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-600">New Action</p>

        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/92 transition-opacity duration-200 ${
            isDesktopActionsOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
          }`}
        >
          <button
            type="button"
            className="inline-flex min-h-11 min-w-[170px] items-center justify-center border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-bold uppercase tracking-wide text-text-main transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand"
            onClick={(event) => {
              event.stopPropagation()
              openModal('create')
            }}
          >
            Create a room
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-[170px] items-center justify-center border-2 border-brand bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover hover:border-brand-hover"
            onClick={(event) => {
              event.stopPropagation()
              openModal('join')
            }}
          >
            Join a room
          </button>
        </div>
      </div>

      {shownMode && copy ? (
        <div className={`no-stagger fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 ${isClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-modal-title"
            aria-describedby="room-modal-description"
            tabIndex={-1}
            className={`${isClosing ? 'animate-dialog-out' : 'animate-dialog-in'} max-h-full w-full max-w-md overflow-y-auto border-2 border-zinc-300 bg-white p-5 shadow-xl shadow-black/20 sm:p-6`}
          >
            <form onSubmit={handleSubmit} noValidate>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="room-modal-title" className="text-2xl font-black tracking-tight text-text-main">{copy.title}</h2>
                <p id="room-modal-description" className="mt-1 text-sm text-text-muted">{copy.description}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-brand"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-text-main" htmlFor="room-modal-input">
                {copy.label}
              </label>
              <input
                id="room-modal-input"
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={copy.placeholder}
                className="min-h-12 w-full border-2 border-zinc-300 bg-white px-4 py-3 text-base text-text-main outline-none transition-colors placeholder:text-zinc-500 focus:border-brand disabled:bg-zinc-100"
                disabled={isPending}
                maxLength={shownMode === 'create' ? 60 : 32}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'room-modal-error' : undefined}
                autoComplete="off"
                data-autofocus
              />

              {shownMode === 'create' ? (
                <>
                  <label className="block pt-3 text-sm font-semibold text-text-main" htmlFor="room-modal-event">
                    Event
                  </label>
                  <EventSelect
                    id="room-modal-event"
                    value={eventId}
                    onChange={setEventId}
                    options={events}
                    disabled={isPending}
                    loading={eventsLoading}
                  />

                  <div className="pt-3">
                    <p className="mb-2 block text-sm font-semibold text-text-main">Room duration</p>
                    <div className="flex" role="group" aria-label="Room duration">
                      <button
                        type="button"
                        onClick={() => setEndMode('full_event')}
                        disabled={isPending}
                        aria-pressed={endMode === 'full_event'}
                        className={`min-h-11 flex-1 border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                          endMode === 'full_event'
                            ? 'border-brand bg-brand text-white'
                            : 'border-zinc-300 bg-white text-text-muted hover:border-brand hover:text-text-main'
                        }`}
                      >
                        Full event
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndMode('set_end_date')}
                        disabled={isPending}
                        aria-pressed={endMode === 'set_end_date'}
                        className={`min-h-11 flex-1 border-2 border-l-0 px-4 py-2 text-sm font-semibold transition-colors ${
                          endMode === 'set_end_date'
                            ? 'border-brand bg-brand text-white'
                            : 'border-zinc-300 bg-white text-text-muted hover:border-brand hover:text-text-main'
                        }`}
                      >
                        Set end date
                      </button>
                    </div>
                  </div>

                  {/* The calendar slides open below the toggle instead of popping in. */}
                  <div className="collapsible" data-open={endMode === 'set_end_date'}>
                    <div>
                      <div className="pt-3">
                        <DatePicker
                          value={roomEndAt}
                          onChange={setRoomEndAt}
                          disabled={isPending}
                          inline
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {error ? <p id="room-modal-error" role="alert" className="animate-message-in mt-3 text-sm font-medium text-danger">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-base btn-light rounded-none" onClick={closeModal} disabled={isPending}>
                Cancel
              </button>
              <button type="submit" className="btn-base btn-dark rounded-none" disabled={isPending}>
                {isPending ? 'Working…' : copy.action}
              </button>
            </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

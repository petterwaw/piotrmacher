'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { LogOut, Trash2 } from 'lucide-react'

type ActionType = 'delete' | 'leave' | null

export default function RoomActionsMenu({
  roomId,
  isHost,
}: {
  roomId: string
  isHost: boolean
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ActionType>(null)
  const [isPending, startTransition] = useTransition()

  const handleAction = (action: ActionType) => {
    if (action === 'delete') {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/rooms/${roomId}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            alert(data.error || 'Failed to delete room.')
            return
          }

          alert('Room deleted successfully.')
          router.push('/home')
        } catch {
          alert('Failed to delete room.')
        } finally {
          setConfirmAction(null)
          setIsOpen(false)
        }
      })
    } else if (action === 'leave') {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/rooms/${roomId}/leave`, {
            method: 'POST',
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            alert(data.error || 'Failed to leave room.')
            return
          }

          alert('You left the room.')
          router.push('/home')
        } catch {
          alert('Failed to leave room.')
        } finally {
          setConfirmAction(null)
          setIsOpen(false)
        }
      })
    }
  }

  const action = isHost ? 'delete' : 'leave'
  const actionLabel = isHost ? 'Delete room' : 'Leave room'
  const confirmMessage = isHost
    ? 'Are you sure you want to delete this room? This action cannot be undone.'
    : 'Are you sure you want to leave this room?'
  const Icon = isHost ? Trash2 : LogOut

  if (confirmAction) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
        <div className="border-2 border-zinc-300 bg-white/95 p-4 sm:p-6 w-full sm:max-w-sm sm:w-auto">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-text-main">
            {actionLabel}
          </h3>
          <p className="mb-6 text-sm text-text-muted">{confirmMessage}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmAction(null)}
              disabled={isPending}
              className="flex-1 border-2 border-zinc-300 bg-white/80 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-text-main transition-all hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAction(confirmAction)}
              disabled={isPending}
              className={`flex-1 border-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-all disabled:opacity-50 ${
                isHost
                  ? 'border-red-500 bg-red-500 hover:bg-red-600'
                  : 'border-brand bg-brand hover:bg-brand-hover'
              }`}
            >
              {isPending ? 'Processing...' : actionLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-12 w-12 items-center justify-center text-text-main transition-colors hover:text-brand"
        title={actionLabel}
      >
        <Icon size={24} />
      </button>

      {isOpen && (
        <div className="absolute -left-2 top-14 z-50 min-w-max border-2 border-zinc-300 bg-white md:min-w-[200px]">
          <button
            onClick={() => {
              setConfirmAction(action as ActionType)
              setIsOpen(false)
            }}
            disabled={isPending}
            className={`flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
              isHost
                ? 'text-red-600 hover:bg-red-50'
                : 'text-brand hover:bg-brand/10'
            }`}
          >
            <Icon size={16} />
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}

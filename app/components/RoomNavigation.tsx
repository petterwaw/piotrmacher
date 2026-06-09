'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Ticket, Clock, Trophy, BookOpen, Settings, Trash2, LogOut, Share2, Copy, Check, ListOrdered } from 'lucide-react'
import { useState, useTransition } from 'react'

const tabIcons: Record<string, React.ElementType> = {
  Bets: Ticket,
  History: Clock,
  Pickem: ListOrdered,
  Standings: Trophy,
  Rules: BookOpen,
  Settings: Settings,
}

type ActionType = 'delete' | 'leave' | null

export default function RoomNavigation({
  roomId,
  roomStatus,
  showSettings,
  isHost,
  inviteCode,
}: {
  roomId: string
  roomStatus: 'waiting' | 'active' | 'finished'
  showSettings: boolean
  isHost: boolean
  inviteCode: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [confirmAction, setConfirmAction] = useState<ActionType>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleCopyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const tabs: Array<{ href: string; label: string; exact?: boolean }> = []

  if (roomStatus === 'active') {
    tabs.push({ href: `/home/${roomId}`, label: 'Bets', exact: true })
  }

  if (roomStatus !== 'waiting') {
    tabs.push({ href: `/home/${roomId}/history`, label: 'History' })
  }

  tabs.push({ href: `/home/${roomId}/pickem`, label: 'Pickem' })

  tabs.push(
    { href: `/home/${roomId}/standings`, label: 'Standings' },
    { href: `/home/${roomId}/rules`, label: 'Rules' }
  )

  if (showSettings) {
    tabs.push({ href: `/home/${roomId}/settings`, label: 'Settings' })
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

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

          router.push('/home')
        } catch {
          alert('Failed to delete room.')
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

          router.push('/home')
        } catch {
          alert('Failed to leave room.')
        }
      })
    }
  }

  return (
    <>
      {/* Invite Code Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 pointer-events-auto">
          <div className="border-2 border-zinc-300 bg-white/95 p-4 mx-4 w-full max-w-sm pointer-events-auto">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-text-main">
              Invite code
            </h3>
            <p className="mb-4 text-xs text-text-muted">Share this code with others to invite them to the room</p>
            
            <div className="mb-6 p-3">
              <p className="text-center font-black text-brand text-lg">{inviteCode?.toUpperCase()}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 border-2 border-zinc-300 bg-white/80 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-text-main transition-all hover:bg-zinc-100"
              >
                Close
              </button>
              <button
                onClick={handleCopyInviteCode}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-brand bg-brand px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-all hover:bg-brand-hover"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (() => {
        const actionLabel = isHost ? 'Delete room' : 'Leave room'
        const confirmMessage = isHost
          ? 'Are you sure you want to delete this room? This action cannot be undone.'
          : 'Are you sure you want to leave this room?'

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 pointer-events-auto">
            <div className="border-2 border-zinc-300 bg-white/95 p-4 mx-4 w-full max-w-sm pointer-events-auto">
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
      })()}

      {/* Desktop sidebar nav */}
      <div className="mb-6 hidden md:block">
        <div className="flex w-full flex-col gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-2 text-left text-sm font-medium transition-colors ${
                isActive(tab.href, tab.exact)
                  ? 'bg-white text-brand'
                  : 'text-text-muted hover:bg-zinc-100 hover:text-text-main'
              }`}
            >
              {tab.label}
            </Link>
          ))}

          {/* Separator */}
          {(isHost || !isHost) && <div className="my-2 border-t-2 border-zinc-200" />}

          {/* Invite code button (only for host) */}
          {isHost && inviteCode && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand transition-colors hover:bg-brand/10"
            >
              <Share2 size={16} />
              Invite
            </button>
          )}

          {/* Action button */}
          <button
            onClick={() => setConfirmAction(isHost ? 'delete' : 'leave')}
            disabled={isPending}
            className={`flex items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
              isHost
                ? 'text-red-600 hover:bg-red-50'
                : 'text-brand hover:bg-brand/10'
            }`}
          >
            {isHost ? <Trash2 size={16} /> : <LogOut size={16} />}
            {isHost ? 'Delete' : 'Leave'}
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t-2 border-zinc-300 bg-white md:hidden">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.label]
          const active = isActive(tab.href, tab.exact)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                active ? 'text-brand' : 'text-zinc-400 hover:text-brand'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {tab.label}
            </Link>
          )
        })}

        {/* Mobile invite button (only for host) */}
        {isHost && inviteCode && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand hover:text-brand/80"
          >
            <Share2 size={20} />
            Invite
          </button>
        )}

        {/* Mobile action button */}
        <button
          onClick={() => setConfirmAction(isHost ? 'delete' : 'leave')}
          disabled={isPending}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
            isHost
              ? 'text-red-600 hover:text-red-700'
              : 'text-zinc-400 hover:text-brand'
          }`}
        >
          {isHost ? <Trash2 size={20} /> : <LogOut size={20} />}
          {isHost ? 'Delete' : 'Leave'}
        </button>
      </nav>
    </>
  )
}

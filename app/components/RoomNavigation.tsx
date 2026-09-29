'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Ticket, Clock, Trophy, BookOpen, Settings, Trash2, LogOut, Share2, ListOrdered } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
import { usePresence } from '@/app/components/motion/usePresence'
import { useDialogFocus } from '@/app/components/a11y/useDialogFocus'
import InviteShare from '@/app/components/InviteShare'

const tabIcons: Record<string, React.ElementType> = {
  Bets: Ticket,
  History: Clock,
  Pickem: ListOrdered,
  Standings: Trophy,
  Rules: BookOpen,
  Settings: Settings,
}

type ActionType = 'delete' | 'leave' | null

// Shared shape for every item in the mobile bottom tab bar. A single sliding
// bar (see the indicator in the mobile nav) marks the current tab.
const MOBILE_TAB =
  'press relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 pb-1.5 pt-2 text-[10px] leading-none transition-colors min-[400px]:text-[11px]'

// Desktop sidebar rows are exactly 40px tall with a 4px gap; the highlight
// slides by that pitch.
const DESKTOP_ROW_PITCH_PX = 44

export default function RoomNavigation({
  roomId,
  roomStatus,
  showSettings,
  showPickem,
  isHost,
  inviteCode,
  eventName,
}: {
  roomId: string
  roomStatus: 'waiting' | 'active' | 'finished'
  showSettings: boolean
  showPickem: boolean
  isHost: boolean
  inviteCode: string | null
  eventName?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [confirmAction, setConfirmAction] = useState<ActionType>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  // Keep dialogs mounted while they play their exit animation.
  const invitePresence = usePresence(showInviteModal)
  const confirmPresence = usePresence(confirmAction)
  const confirmDialogRef = useRef<HTMLDivElement>(null)
  const inviteDialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(inviteDialogRef, showInviteModal, () => setShowInviteModal(false))
  useDialogFocus(confirmDialogRef, Boolean(confirmAction), () => {
    if (!isPending) setConfirmAction(null)
  })

  const tabs: Array<{ href: string; label: string; exact?: boolean }> = []

  if (roomStatus === 'active') {
    tabs.push({ href: `/home/${roomId}`, label: 'Bets', exact: true })
  }

  if (roomStatus !== 'waiting') {
    tabs.push({ href: `/home/${roomId}/history`, label: 'History' })
  }

  if (showPickem) {
    tabs.push({ href: `/home/${roomId}/pickem`, label: 'Pickem' })
  }

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

  const activeIndex = tabs.findIndex((tab) => isActive(tab.href, tab.exact))
  const mobileItemCount = tabs.length + (isHost && inviteCode ? 1 : 0) + 1

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
      {invitePresence.value && (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 ${invitePresence.isClosing ? 'animate-overlay-out' : 'animate-overlay-in pointer-events-auto'}`}>
          <div ref={inviteDialogRef} role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" tabIndex={-1} className={`w-full max-w-sm border-2 border-zinc-300 bg-white p-5 shadow-xl shadow-black/20 ${invitePresence.isClosing ? 'animate-dialog-out' : 'animate-dialog-in pointer-events-auto'}`}>
            <h3 id="invite-dialog-title" className="mb-2 text-sm font-bold uppercase tracking-wide text-text-main">
              Invite friends
            </h3>
            <p className="mb-4 text-sm text-text-muted">Send the link. Friends sign in and land straight in this room.</p>

            {inviteCode ? (
              <InviteShare code={inviteCode} eventName={eventName} onClose={() => setShowInviteModal(false)} />
            ) : null}
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmPresence.value && (() => {
        const shownAction = confirmPresence.value
        const actionLabel = isHost ? 'Delete room' : 'Leave room'
        const confirmMessage = isHost
          ? 'Are you sure you want to delete this room? This action cannot be undone.'
          : 'Are you sure you want to leave this room?'

        return (
          <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 ${confirmPresence.isClosing ? 'animate-overlay-out' : 'animate-overlay-in pointer-events-auto'}`}>
            <div ref={confirmDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="room-action-title" aria-describedby="room-action-desc" tabIndex={-1} className={`w-full max-w-sm border-2 border-zinc-300 bg-white p-5 shadow-xl shadow-black/20 ${confirmPresence.isClosing ? 'animate-dialog-out' : 'animate-dialog-in pointer-events-auto'}`}>
              <h3 id="room-action-title" className="mb-2 text-sm font-bold uppercase tracking-wide text-text-main">
                {actionLabel}
              </h3>
              <p id="room-action-desc" className="mb-6 text-sm text-text-muted">{confirmMessage}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={isPending}
                  className="min-h-11 flex-1 border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-semibold uppercase tracking-wide text-text-main transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(shownAction)}
                  disabled={isPending}
                  className={`min-h-11 flex-1 border-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors disabled:opacity-50 ${
                    isHost
                      ? 'border-red-600 bg-red-600 hover:border-red-700 hover:bg-red-700'
                      : 'border-brand bg-brand hover:border-brand-hover hover:bg-brand-hover'
                  }`}
                >
                  {isPending ? 'Processing…' : actionLabel}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Desktop sidebar nav */}
      <nav aria-label="Room" className="mb-6 hidden md:block">
        <div className="relative flex w-full flex-col gap-1">
          {/* Current-page highlight: one surface that slides between rows. */}
          <div
            aria-hidden="true"
            className={`indicator-slide pointer-events-none absolute inset-x-0 top-0 h-10 bg-white shadow-sm ${activeIndex < 0 ? 'opacity-0' : 'opacity-100'}`}
            style={{ transform: `translateY(${Math.max(activeIndex, 0) * DESKTOP_ROW_PITCH_PX}px)` }}
          />
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive(tab.href, tab.exact) ? 'page' : undefined}
              className={`press relative flex min-h-10 items-center px-3 py-2 text-left text-sm transition-colors ${
                isActive(tab.href, tab.exact)
                  ? 'font-bold text-brand'
                  : 'font-medium text-zinc-700 hover:bg-white/60 hover:text-text-main'
              }`}
            >
              {tab.label}
            </Link>
          ))}

          {/* Separator */}
          <div className="my-2 border-t-2 border-zinc-200" />

          {/* Invite code button (only for host) */}
          {isHost && inviteCode && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="flex min-h-10 items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-brand transition-colors hover:bg-brand-tint"
            >
              <Share2 size={16} aria-hidden="true" />
              Invite
            </button>
          )}

          {/* Action button */}
          <button
            type="button"
            onClick={() => setConfirmAction(isHost ? 'delete' : 'leave')}
            disabled={isPending}
            className={`flex min-h-10 items-center gap-2 px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-50 ${
              isHost
                ? 'text-red-700 hover:bg-red-50'
                : 'text-zinc-700 hover:bg-white/60 hover:text-text-main'
            }`}
          >
            {isHost ? <Trash2 size={16} aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}
            {isHost ? 'Delete' : 'Leave'}
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Room"
        // Own view-transition layer: the tab bar stays above (and unaffected by)
        // skeleton -> content crossfades. Only one copy is ever rendered.
        style={{ viewTransitionName: 'room-tabbar' }}
        className="fixed bottom-0 left-0 right-0 z-50 flex border-t-2 border-zinc-300 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {/* Current-tab bar: slides between the equal-width items. */}
        <div
          aria-hidden="true"
          className={`indicator-slide pointer-events-none absolute left-0 top-0 ${activeIndex < 0 ? 'opacity-0' : 'opacity-100'}`}
          style={{
            width: `${100 / mobileItemCount}%`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        >
          <div className="mx-2 h-0.5 bg-brand" />
        </div>
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.label]
          const active = isActive(tab.href, tab.exact)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`${MOBILE_TAB} ${
                active ? 'font-bold text-brand' : 'font-semibold text-zinc-600 active:bg-zinc-100'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
              <span className="max-w-full truncate">{tab.label}</span>
            </Link>
          )
        })}

        {/* Mobile invite button (only for host) */}
        {isHost && inviteCode && (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className={`${MOBILE_TAB} font-semibold text-brand active:bg-brand-tint`}
          >
            <Share2 size={20} aria-hidden="true" />
            <span className="max-w-full truncate">Invite</span>
          </button>
        )}

        {/* Mobile action button */}
        <button
          type="button"
          onClick={() => setConfirmAction(isHost ? 'delete' : 'leave')}
          disabled={isPending}
          className={`${MOBILE_TAB} font-semibold disabled:opacity-50 ${
            isHost
              ? 'text-red-700 active:bg-red-50'
              : 'text-zinc-600 active:bg-zinc-100'
          }`}
        >
          {isHost ? <Trash2 size={20} aria-hidden="true" /> : <LogOut size={20} aria-hidden="true" />}
          <span className="max-w-full truncate">{isHost ? 'Delete' : 'Leave'}</span>
        </button>
      </nav>
    </>
  )
}

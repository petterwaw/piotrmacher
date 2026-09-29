'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { clearPendingInvite, invitePath, readPendingInvite } from '@/app/utils/share/invite'

const noopSubscribe = () => () => {}

// Someone opened an invite link, then signed up and confirmed their e-mail
// (which lands on /home, not back on the link). Offer to finish joining.
export default function PendingInviteBanner() {
  const pendingCode = useSyncExternalStore(noopSubscribe, readPendingInvite, () => null)
  const [dismissed, setDismissed] = useState(false)

  if (!pendingCode || dismissed) return null

  return (
    <div className="animate-message-in mb-5 flex items-center gap-3 border-2 border-brand bg-brand-tint py-2 pl-4 pr-1">
      <p className="min-w-0 flex-1 text-sm font-semibold text-text-main">You were invited to a room.</p>
      <Link
        href={invitePath(pendingCode)}
        className="press-soft inline-flex min-h-11 shrink-0 items-center border-2 border-brand bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-brand-hover hover:bg-brand-hover"
      >
        Join now
      </Link>
      <button
        type="button"
        aria-label="Dismiss invite"
        onClick={() => {
          clearPendingInvite()
          setDismissed(true)
        }}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-brand"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

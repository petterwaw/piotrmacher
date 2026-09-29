'use client'

import { Check, Copy, Share2 } from 'lucide-react'
import { useRef, useState, useSyncExternalStore } from 'react'
import { SITE_URL, formatInviteCode, inviteMessage, inviteUrl } from '@/app/utils/share/invite'

const noopSubscribe = () => () => {}

function useCanNativeShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false
  )
}

function useOrigin() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => SITE_URL
  )
}

type Copied = 'link' | 'code' | 'message' | null

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Invite link + code with share / copy actions. Used by the room's Invite
// dialog and the Settings page. `onClose` adds a Close button (dialog use).
export default function InviteShare({
  code,
  eventName,
  onClose,
}: {
  code: string
  eventName?: string | null
  onClose?: () => void
}) {
  const origin = useOrigin()
  const canNativeShare = useCanNativeShare()
  const [copied, setCopied] = useState<Copied>(null)
  const [copyError, setCopyError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const url = inviteUrl(code, origin)
  const displayUrl = url.replace(/^https?:\/\//, '')
  const message = inviteMessage(code, eventName)

  const flash = (what: Copied) => {
    setCopyError(false)
    setCopied(what)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2000)
  }

  const copy = async (what: Exclude<Copied, null>) => {
    const text = what === 'link' ? url : what === 'code' ? formatInviteCode(code) : `${message}\n${url}`
    if (await writeClipboard(text)) {
      flash(what)
    } else {
      setCopied(null)
      setCopyError(true)
    }
  }

  const share = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title: 'Piotrmacher invite', text: message, url })
        return
      } catch (error) {
        // The user closed the share sheet: nothing to do.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    await copy('message')
  }

  return (
    <div>
      <label htmlFor={`invite-link-${code}`} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-600">
        Invite link
      </label>
      <div className="flex items-stretch border-2 border-brand/40 bg-brand-tint">
        <input
          id={`invite-link-${code}`}
          readOnly
          value={displayUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] font-semibold text-brand outline-none"
        />
        <button
          type="button"
          onClick={() => copy('link')}
          aria-label={copied === 'link' ? 'Link copied' : 'Copy invite link'}
          title="Copy link"
          className="press inline-flex min-h-11 w-11 shrink-0 items-center justify-center border-l-2 border-brand/40 text-brand transition-colors hover:bg-brand hover:text-white"
        >
          {copied === 'link' ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        </button>
      </div>

      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-zinc-600">
          Code{' '}
          <span className="select-all font-mono font-bold tracking-[0.04em] text-text-main">{formatInviteCode(code)}</span>
        </p>
        <button
          type="button"
          onClick={() => copy('code')}
          className="press shrink-0 px-2 py-2 text-xs font-bold uppercase tracking-wide text-brand transition-colors hover:text-brand-hover"
        >
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </button>
      </div>

      <p className="mt-1 text-xs leading-snug text-zinc-600">
        Anyone with this link or code can join. Link previews only show Piotrmacher, never the room.
      </p>

      <p role="status" aria-live="polite" className="min-h-5 pt-1 text-sm font-semibold">
        {copyError ? (
          <span className="text-danger">Couldn&apos;t copy. Select the link and copy it manually.</span>
        ) : copied === 'message' ? (
          <span className="text-brand">Invite message copied. Paste it in your group chat.</span>
        ) : copied === 'link' ? (
          <span className="text-brand">Link copied.</span>
        ) : null}
      </p>

      <div className="mt-2 flex gap-3">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 border-2 border-zinc-300 bg-white px-5 py-2 text-sm font-semibold uppercase tracking-wide text-text-main transition-colors hover:border-zinc-400 hover:bg-zinc-50"
          >
            Close
          </button>
        ) : null}
        <button
          type="button"
          onClick={share}
          className="press-soft flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap border-2 border-brand bg-brand px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-brand-hover hover:bg-brand-hover"
        >
          {canNativeShare ? (
            <>
              <Share2 size={16} aria-hidden="true" />
              Share invite
            </>
          ) : copied === 'message' ? (
            <>
              <Check size={16} aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy size={16} aria-hidden="true" />
              Copy invite
            </>
          )}
        </button>
      </div>
    </div>
  )
}

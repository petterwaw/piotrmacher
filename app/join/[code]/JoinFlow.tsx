'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { displayFont } from '@/app/components/landing/fonts'
import { joinRoom } from '@/app/utils/rooms/joinRoom'
import {
  clearPendingInvite,
  formatInviteCode,
  invitePath,
  openAuth,
  rememberPendingInvite,
} from '@/app/utils/share/invite'

const display = `${displayFont.className} font-extrabold uppercase italic`
const primary =
  'press-soft inline-flex min-h-12 w-full items-center justify-center border-2 border-brand bg-brand px-6 text-base font-bold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover'
const secondary =
  'press-soft inline-flex min-h-12 w-full items-center justify-center border-2 border-zinc-300 bg-white px-6 text-base font-bold text-text-main transition-colors hover:border-brand hover:text-brand'

type JoinState = 'joining' | 'not-found' | 'failed'

const AUTH_CONTEXT = 'Sign in to join the room you were invited to.'

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-1 items-start justify-center px-4 pb-16 pt-8 md:items-center md:px-6 md:py-20">
      <section className="animate-dialog-in w-full max-w-md border-2 border-zinc-300 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
        <h1 className={`${display} mt-2 text-balance text-[2.75rem] leading-[0.92] text-text-main`}>{title}</h1>
        {children}
      </section>
    </div>
  )
}

export default function JoinFlow({ code, signedIn }: { code: string | null; signedIn: boolean }) {
  if (!code) {
    return (
      <Card eyebrow="Invite link" title="This link is broken">
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          The invite code in this link isn&apos;t valid. Ask the host to send the link again, or paste the code in
          Join a room.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/home" className={primary}>
            Go to my rooms
          </Link>
        </div>
      </Card>
    )
  }

  return signedIn ? <JoinSignedIn code={code} /> : <JoinSignedOut code={code} />
}

function JoinSignedOut({ code }: { code: string }) {
  const next = invitePath(code)

  useEffect(() => {
    // Survives sign-up + e-mail confirmation, which drop the `next` target.
    rememberPendingInvite(code)
    openAuth({ mode: 'signin', next, context: AUTH_CONTEXT })
  }, [code, next])

  return (
    <Card eyebrow="You're invited" title="Join a prediction room">
      <p className="mt-4 text-base leading-relaxed text-text-muted">
        A friend wants you in their room on Piotrmacher. Predict the exact score of every match, earn points after
        the final whistle and see who tops the table.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" className={primary} onClick={() => openAuth({ mode: 'signin', next, context: AUTH_CONTEXT })}>
          Sign in to join
        </button>
        <button
          type="button"
          className={secondary}
          onClick={() => openAuth({ mode: 'signup', next, context: AUTH_CONTEXT })}
        >
          Create a free account
        </button>
      </div>
      <p className="mt-4 text-sm text-zinc-600">
        Invite code <span className="font-mono font-bold tracking-[0.12em] text-text-main">{formatInviteCode(code)}</span>
      </p>
    </Card>
  )
}

function JoinSignedIn({ code }: { code: string }) {
  const router = useRouter()
  const [state, setState] = useState<JoinState>('joining')
  const [attempt, setAttempt] = useState(0)
  const startedFor = useRef<number | null>(null)

  useEffect(() => {
    // Strict Mode runs effects twice; join once per attempt.
    if (startedFor.current === attempt) return
    startedFor.current = attempt

    // No cancellation flag: Strict Mode's cleanup would drop the only request.
    const run = async () => {
      try {
        const response = await joinRoom({ code })
        const data = (await response.json().catch(() => ({}))) as { roomId?: string }

        if (response.ok && data.roomId) {
          clearPendingInvite()
          router.replace(`/home/${data.roomId}`)
          return
        }
        if (response.status === 401) {
          // Session expired between render and request.
          router.refresh()
          return
        }
        if (response.status === 400 || response.status === 404) {
          clearPendingInvite()
          setState('not-found')
          return
        }
        setState('failed')
      } catch {
        setState('failed')
      }
    }
    void run()
  }, [attempt, code, router])

  if (state === 'not-found') {
    return (
      <Card eyebrow="Invite link" title="This invite has expired">
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          No open room uses this code. The room may have finished, been deleted, or the host sent a different code.
          Ask them for a fresh link.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/home" className={primary}>
            Go to my rooms
          </Link>
        </div>
      </Card>
    )
  }

  if (state === 'failed') {
    return (
      <Card eyebrow="Invite link" title="Couldn't join right now">
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          Something went wrong on our side. Check your connection and try again.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className={primary}
            onClick={() => {
              setState('joining')
              setAttempt((value) => value + 1)
            }}
          >
            Try again
          </button>
          <Link href="/home" className={secondary}>
            Go to my rooms
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card eyebrow="You're invited" title="Joining the room">
      <div role="status" aria-live="polite" className="mt-5 flex items-center gap-3 text-base text-text-muted">
        <span
          aria-hidden="true"
          className="inline-block h-5 w-5 border-2 border-brand border-t-transparent motion-safe:animate-spin"
        />
        Taking you to your seat…
      </div>
    </Card>
  )
}

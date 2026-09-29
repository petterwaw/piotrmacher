'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ProfileSkeleton } from '@/app/components/LoadingSkeletons'

const INPUT =
  'min-h-11 w-full border-2 border-zinc-300 bg-white px-3 py-2 text-base text-text-main outline-none transition-colors placeholder:text-zinc-500 focus:border-brand sm:text-sm'
const ROW = 'flex flex-wrap items-center gap-x-3 gap-y-4 px-4 py-3.5 sm:px-5'
const TERM = 'text-sm text-zinc-600'
const FIELD_LABEL = 'mb-1.5 block text-sm font-semibold text-text-main'
const TOGGLE =
  'inline-flex min-h-11 min-w-24 items-center justify-center border-2 border-zinc-300 bg-white px-4 text-sm font-semibold text-text-main transition-colors hover:border-brand hover:text-brand aria-expanded:border-zinc-300 aria-expanded:text-zinc-700'
const PRIMARY =
  'inline-flex min-h-11 items-center justify-center border-2 border-brand bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-hover hover:bg-brand-hover active:bg-brand-hover disabled:opacity-60'

type Profile = {
  id: string
  email: string
  username: string
  createdAt?: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [editingUsername, setEditingUsername] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' })
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          profile?: Profile
        }

        if (response.status === 401) {
          window.location.href = '/home'
          return
        }

        if (!response.ok || !data.profile) {
          throw new Error(data.error || 'Could not load profile.')
        }

        setProfile(data.profile)
        setUsername(data.profile.username)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load profile.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const createdAtLabel = useMemo(() => {
    if (!profile?.createdAt) return 'Unknown'
    const date = new Date(profile.createdAt)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return date.toLocaleDateString('pl-PL')
  }, [profile?.createdAt])

  const updateUsername = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        })

        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          username?: string
        }

        if (!response.ok || !data.username) {
          throw new Error(data.error || 'Could not update username.')
        }

        setProfile((prev) => (prev ? { ...prev, username: data.username as string } : prev))
        setMessage('Username updated.')
        setEditingUsername(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update username.')
      }
    })
  }

  const updatePassword = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/profile/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not update password.')
        }

        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setMessage('Password updated.')
        setEditingPassword(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update password.')
      }
    })
  }

  const deleteAccount = () => {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/profile', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: deleteConfirm }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not delete account.')
        }

        window.location.href = '/home'
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete account.')
      }
    })
  }

  if (loading) {
    return <ProfileSkeleton />
  }

  return (
    <div className='mx-auto w-full max-w-xl px-4 py-8 md:px-6 md:py-10'>
      <h1 className='text-2xl font-black tracking-tight text-text-main'>Account</h1>
      <p className='mt-1 text-sm text-zinc-600'>
        Member since <span className='tabular-nums'>{createdAtLabel}</span>
      </p>

      {error ? <p role='alert' className='mt-5 border-2 border-danger/40 bg-white p-3 text-sm font-medium text-danger'>{error}</p> : null}
      {message ? <p role='status' className='mt-5 border-2 border-brand/40 bg-brand-tint p-3 text-sm font-medium text-brand'>{message}</p> : null}

      <div className='mt-5 divide-y-2 divide-zinc-200 border-2 border-zinc-300 bg-white'>
        <div className={ROW}>
          <div className='min-w-0 flex-1'>
            <p className={TERM}>Username</p>
            <div className='mt-0.5 truncate text-base font-bold text-text-main'>{profile?.username ?? '-'}</div>
          </div>
          <div>
            <button
              type='button'
              onClick={() => { setEditingUsername((v) => !v); setEditingPassword(false) }}
              className={TOGGLE}
              aria-expanded={editingUsername}
              aria-controls='username-form'
            >
              {editingUsername ? 'Cancel' : 'Change'}
              <span className='sr-only'> username</span>
            </button>
          </div>
          {editingUsername && (
            <div id='username-form' className='animate-pop-in basis-full'>
              <label htmlFor='username' className={FIELD_LABEL}>New username</label>
              <input
                id='username'
                name='username'
                aria-describedby='username-hint'
                autoComplete='username'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT}
              />
              <p id='username-hint' className='mt-1.5 text-sm text-zinc-600'>3–24 characters: letters, numbers, _ or .</p>
              <button
                type='button'
                className={`${PRIMARY} mt-3`}
                onClick={updateUsername}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Save username'}
              </button>
            </div>
          )}
        </div>

        <div className={ROW}>
          <div className='min-w-0 flex-1'>
            <p className={TERM}>Email</p>
            <div className='mt-0.5 break-all text-base text-text-main'>{profile?.email ?? '-'}</div>
          </div>
        </div>

        <div className={ROW}>
          <div className='min-w-0 flex-1'>
            <p className={TERM}>Password</p>
            <p className='mt-0.5 text-base tracking-widest text-text-main'><span aria-hidden='true'>••••••••</span><span className='sr-only'>Hidden</span></p>
          </div>
          <div>
            <button
              type='button'
              onClick={() => { setEditingPassword((v) => !v); setEditingUsername(false) }}
              className={TOGGLE}
              aria-expanded={editingPassword}
              aria-controls='password-form'
            >
              {editingPassword ? 'Cancel' : 'Change'}
              <span className='sr-only'> password</span>
            </button>
          </div>
          {editingPassword && (
            <div id='password-form' className='animate-pop-in basis-full space-y-3'>
              <div>
                <label htmlFor='current-password' className={FIELD_LABEL}>Current password</label>
                <input
                  id='current-password'
                  type='password'
                  autoComplete='current-password'
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor='new-password' className={FIELD_LABEL}>New password</label>
                <input
                  id='new-password'
                  type='password'
                  aria-describedby='new-password-hint'
                  autoComplete='new-password'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={INPUT}
                />
                <p id='new-password-hint' className='mt-1.5 text-sm text-zinc-600'>At least 8 characters.</p>
              </div>
              <div>
                <label htmlFor='confirm-password' className={FIELD_LABEL}>Repeat new password</label>
                <input
                  id='confirm-password'
                  type='password'
                  autoComplete='new-password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={INPUT}
                />
              </div>
              <button
                type='button'
                className={PRIMARY}
                onClick={updatePassword}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Change password'}
              </button>
            </div>
          )}
        </div>
      </div>

      <section aria-labelledby='delete-account' className='mt-12 border-t-2 border-zinc-300 pt-6'>
        <h2 id='delete-account' className='text-base font-black tracking-tight text-danger'>Delete account</h2>
        <p className='mt-1 text-sm leading-relaxed text-zinc-700'>
          Rooms you host are deleted for everyone in them. In other rooms, your bets and membership are removed.
          This can&apos;t be undone.
        </p>
        <label htmlFor='delete-confirm' className={`${FIELD_LABEL} mt-4`}>
          Type <span className='font-mono font-bold'>DELETE</span> to confirm
        </label>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <input
            id='delete-confirm'
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoComplete='off'
            className='min-h-11 w-full border-2 border-zinc-300 bg-white px-3 py-2 text-base text-text-main outline-none transition-colors focus:border-danger sm:max-w-56 sm:text-sm'
          />
          <button
            type='button'
            className='inline-flex min-h-11 shrink-0 items-center justify-center border-2 border-danger bg-white px-5 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger hover:text-white active:bg-danger-hover active:text-white disabled:opacity-60 disabled:hover:bg-white disabled:hover:text-danger'
            onClick={deleteAccount}
            disabled={isPending}
          >
            {isPending ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </section>
    </div>
  )
}

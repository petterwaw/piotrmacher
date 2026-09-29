'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Pencil, X } from 'lucide-react'
import { ProfileSkeleton } from '@/app/components/LoadingSkeletons'

const INPUT =
  'min-h-11 w-full border-2 border-zinc-300 bg-white px-3 py-2 text-base text-text-main outline-none transition-colors placeholder:text-zinc-500 focus:border-brand sm:text-sm'
const LABEL = 'text-xs font-bold uppercase tracking-wide text-zinc-600'
const EDIT_TOGGLE =
  'ml-3 inline-flex h-10 w-10 shrink-0 items-center justify-center border-2 border-zinc-300 bg-white text-zinc-700 transition-colors hover:border-brand hover:text-brand aria-expanded:border-brand aria-expanded:text-brand'
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
    return date.toLocaleString('pl-PL')
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
    <div className='mx-auto w-full max-w-xl space-y-4 px-4 py-8 md:px-6'>
      <h1 className='sr-only'>Account</h1>
      {error ? <p role='alert' className='border-2 border-orange-400 bg-orange-50 p-3 text-sm font-medium text-orange-900'>{error}</p> : null}
      {message ? <p role='status' className='border-2 border-brand/50 bg-brand-tint p-3 text-sm font-medium text-brand'>{message}</p> : null}

      {/* Account info card */}
      <div className='border-2 border-zinc-300 bg-white/90 divide-y divide-zinc-200'>

        {/* Email row */}
        <div className='flex min-h-16 items-center justify-between px-4 py-3'>
          <div className='min-w-0'>
            <p className={LABEL}>Email</p>
            <p className='mt-0.5 break-all text-sm font-medium text-text-main'>{profile?.email ?? '-'}</p>
          </div>
        </div>

        {/* Username row */}
        <div className='px-4 py-3'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0'>
              <p className={LABEL}>Username</p>
              <p className='mt-0.5 truncate text-sm font-medium text-text-main'>{profile?.username ?? '-'}</p>
            </div>
            <button
              type='button'
              onClick={() => { setEditingUsername((v) => !v); setEditingPassword(false) }}
              className={EDIT_TOGGLE}
              aria-label='Edit username'
              aria-expanded={editingUsername}
            >
              {editingUsername ? <X size={16} aria-hidden='true' /> : <Pencil size={16} aria-hidden='true' />}
            </button>
          </div>
          {editingUsername && (
            <div className='animate-pop-in mt-3 space-y-2'>
              <input
                id='username'
                name='username'
                aria-label='New username'
                autoComplete='username'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT}
              />
              <button
                type='button'
                className={PRIMARY}
                onClick={updateUsername}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Save username'}
              </button>
            </div>
          )}
        </div>

        {/* Password row */}
        <div className='px-4 py-3'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0'>
              <p className={LABEL}>Password</p>
              <p className='mt-0.5 text-sm font-medium tracking-widest text-text-main'>••••••••</p>
            </div>
            <button
              type='button'
              onClick={() => { setEditingPassword((v) => !v); setEditingUsername(false) }}
              className={EDIT_TOGGLE}
              aria-label='Edit password'
              aria-expanded={editingPassword}
            >
              {editingPassword ? <X size={16} aria-hidden='true' /> : <Pencil size={16} aria-hidden='true' />}
            </button>
          </div>
          {editingPassword && (
            <div className='animate-pop-in mt-3 space-y-2'>
              <input
                type='password'
                aria-label='Current password'
                autoComplete='current-password'
                placeholder='Current password'
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={INPUT}
              />
              <input
                type='password'
                aria-label='New password'
                autoComplete='new-password'
                placeholder='New password'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={INPUT}
              />
              <input
                type='password'
                aria-label='Confirm new password'
                autoComplete='new-password'
                placeholder='Confirm new password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT}
              />
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

        {/* Member since row */}
        <div className='flex min-h-16 items-center justify-between px-4 py-3'>
          <div>
            <p className={LABEL}>Member since</p>
            <p className='mt-0.5 text-sm font-medium tabular-nums text-text-main'>{createdAtLabel}</p>
          </div>
        </div>
      </div>

      {/* Delete account */}
      <section className='border-2 border-orange-400 bg-orange-50 p-4 sm:p-5'>
        <h2 className='mb-2 text-lg font-black tracking-tight text-orange-900'>Delete account</h2>
        <p className='mb-3 text-sm leading-relaxed text-orange-900'>
          If you are host, rooms created by you will be removed. If you are only a participant,
          your room memberships and bets will be removed.
        </p>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder='Type DELETE to confirm'
          aria-label='Type DELETE to confirm'
          autoComplete='off'
          className='min-h-11 w-full border-2 border-orange-400 bg-white px-3 py-2 text-base text-text-main outline-none transition-colors placeholder:text-orange-900/60 focus:border-danger sm:text-sm'
        />
        <button
          type='button'
          className='mt-3 inline-flex min-h-11 items-center justify-center border-2 border-danger bg-danger px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-danger-hover hover:bg-danger-hover active:bg-danger-hover disabled:opacity-60'
          onClick={deleteAccount}
          disabled={isPending}
        >
          {isPending ? 'Deleting…' : 'Delete my account'}
        </button>
      </section>
    </div>
  )
}

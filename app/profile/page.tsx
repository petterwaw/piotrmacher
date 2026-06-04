'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Pencil, X } from 'lucide-react'
import { ProfileSkeleton } from '@/app/components/LoadingSkeletons'

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
      {error ? <p className='border-2 border-orange-400 bg-orange-50 p-3 text-sm text-orange-800'>{error}</p> : null}
      {message ? <p className='border-2 border-green-500 bg-green-50 p-3 text-sm text-green-700'>{message}</p> : null}

      {/* Account info card */}
      <div className='border-2 border-zinc-300 bg-white/90 divide-y divide-zinc-200'>

        {/* Email row */}
        <div className='flex items-center justify-between px-4 py-3'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-wide text-text-muted'>Email</p>
            <p className='text-sm font-medium text-text-main'>{profile?.email ?? '-'}</p>
          </div>
        </div>

        {/* Username row */}
        <div className='px-4 py-3'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-wide text-text-muted'>Username</p>
              <p className='text-sm font-medium text-text-main'>{profile?.username ?? '-'}</p>
            </div>
            <button
              type='button'
              onClick={() => { setEditingUsername((v) => !v); setEditingPassword(false) }}
              className='ml-3 border-2 border-zinc-300 p-1.5 text-text-muted hover:border-brand hover:text-brand transition-colors'
              aria-label='Edit username'
            >
              {editingUsername ? <X size={14} /> : <Pencil size={14} />}
            </button>
          </div>
          {editingUsername && (
            <div className='mt-3 space-y-2'>
              <input
                id='username'
                name='username'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className='w-full border-2 border-zinc-300 bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-[#66BB6A]'
              />
              <button
                type='button'
                className='border border-[#4CAF50] bg-[#4CAF50] px-5 py-2 text-sm font-semibold text-white hover:bg-[#81C784] hover:border-[#81C784] disabled:opacity-60'
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
            <div>
              <p className='text-xs font-semibold uppercase tracking-wide text-text-muted'>Password</p>
              <p className='text-sm font-medium text-text-main'>••••••••</p>
            </div>
            <button
              type='button'
              onClick={() => { setEditingPassword((v) => !v); setEditingUsername(false) }}
              className='ml-3 border-2 border-zinc-300 p-1.5 text-text-muted hover:border-brand hover:text-brand transition-colors'
              aria-label='Edit password'
            >
              {editingPassword ? <X size={14} /> : <Pencil size={14} />}
            </button>
          </div>
          {editingPassword && (
            <div className='mt-3 space-y-2'>
              <input
                type='password'
                placeholder='Current password'
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className='w-full border-2 border-zinc-300 bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-[#66BB6A]'
              />
              <input
                type='password'
                placeholder='New password'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className='w-full border-2 border-zinc-300 bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-[#66BB6A]'
              />
              <input
                type='password'
                placeholder='Confirm new password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className='w-full border-2 border-zinc-300 bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-[#66BB6A]'
              />
              <button
                type='button'
                className='border border-[#4CAF50] bg-[#4CAF50] px-5 py-2 text-sm font-semibold text-white hover:bg-[#81C784] hover:border-[#81C784] disabled:opacity-60'
                onClick={updatePassword}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Change password'}
              </button>
            </div>
          )}
        </div>

        {/* Member since row */}
        <div className='flex items-center justify-between px-4 py-3'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-wide text-text-muted'>Member since</p>
            <p className='text-sm font-medium text-text-main'>{createdAtLabel}</p>
          </div>
        </div>
      </div>

      {/* Delete account */}
      <section className='border-2 border-orange-400 bg-orange-50 p-5'>
        <h3 className='mb-2 text-lg font-semibold text-orange-800'>Delete Account</h3>
        <p className='mb-3 text-sm text-orange-700'>
          If you are host, rooms created by you will be removed. If you are only a participant,
          your room memberships and bets will be removed.
        </p>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder='Type DELETE to confirm'
          className='w-full border-2 border-orange-400 bg-white px-3 py-2 text-sm text-text-main'
        />
        <button
          type='button'
          className='mt-3 border border-[#F97316] bg-[#F97316] px-5 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] hover:border-[#EA580C] disabled:opacity-60'
          onClick={deleteAccount}
          disabled={isPending}
        >
          {isPending ? 'Deleting…' : 'Delete my account'}
        </button>
      </section>
    </div>
  )
}

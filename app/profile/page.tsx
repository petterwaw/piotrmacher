'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' })
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
          profile?: Profile
        }

        if (response.status === 401) {
          window.location.href = '/signin'
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
          headers: {
            'Content-Type': 'application/json',
          },
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not update password.')
        }

        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setMessage('Password updated.')
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirm: deleteConfirm }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Could not delete account.')
        }

        window.location.href = '/signin'
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete account.')
      }
    })
  }

  if (loading) {
    return (
      <div className='mx-auto w-full max-w-3xl px-4 py-8'>
        <p className='text-text-muted'>Loading profile...</p>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6 px-4 py-8'>
      <h2 className='text-2xl font-bold text-text-main'>Profile Settings</h2>

      {error ? <p className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{error}</p> : null}
      {message ? <p className='rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700'>{message}</p> : null}

      <section className='rounded-xl border border-border-soft bg-bg-surface p-5'>
        <h3 className='mb-3 text-lg font-semibold text-text-main'>Account Info</h3>
        <p className='text-sm text-text-muted'>Email: <span className='font-semibold text-text-main'>{profile?.email ?? '-'}</span></p>
        <p className='mt-2 text-sm text-text-muted'>Account created: <span className='font-semibold text-text-main'>{createdAtLabel}</span></p>
      </section>

      <section className='rounded-xl border border-border-soft bg-bg-surface p-5'>
        <h3 className='mb-3 text-lg font-semibold text-text-main'>Username</h3>
        <label htmlFor='username' className='mb-1 block text-sm font-medium text-text-main'>New username</label>
        <input
          id='username'
          name='username'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className='w-full rounded-md border border-border-soft bg-white px-3 py-2 text-sm text-text-main'
        />
        <button type='button' className='btn-base btn-dark mt-3' onClick={updateUsername} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save username'}
        </button>
      </section>

      <section className='rounded-xl border border-border-soft bg-bg-surface p-5'>
        <h3 className='mb-3 text-lg font-semibold text-text-main'>Change Password</h3>
        <div className='grid gap-3'>
          <input
            type='password'
            placeholder='Current password'
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className='w-full rounded-md border border-border-soft bg-white px-3 py-2 text-sm text-text-main'
          />
          <input
            type='password'
            placeholder='New password'
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className='w-full rounded-md border border-border-soft bg-white px-3 py-2 text-sm text-text-main'
          />
          <input
            type='password'
            placeholder='Confirm new password'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className='w-full rounded-md border border-border-soft bg-white px-3 py-2 text-sm text-text-main'
          />
        </div>
        <button type='button' className='btn-base btn-dark mt-3' onClick={updatePassword} disabled={isPending}>
          {isPending ? 'Saving...' : 'Change password'}
        </button>
      </section>

      <section className='rounded-xl border border-red-200 bg-red-50 p-5'>
        <h3 className='mb-2 text-lg font-semibold text-red-700'>Delete Account</h3>
        <p className='mb-3 text-sm text-red-700'>
          If you are host, rooms created by you will be removed. If you are only a participant,
          your room memberships and bets will be removed.
        </p>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder='Type DELETE to confirm'
          className='w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-text-main'
        />
        <button
          type='button'
          className='btn-base mt-3 border-red-600 bg-red-600 text-white hover:bg-red-500 hover:border-red-500'
          onClick={deleteAccount}
          disabled={isPending}
        >
          {isPending ? 'Deleting...' : 'Delete my account'}
        </button>
      </section>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type User = {
  id: string
  email: string
  username: string
} | null

export default function Header() {
  const [user, setUser] = useState<User | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const response = await fetch('/api/auth/user')
        const data = await response.json()
        setUser(data.user)
      } catch (err) {
        console.error('Check user error:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [])

  return (
    <header className='flex min-h-[72px] justify-between items-center bg-brand p-3 shadow-md rounded-b-lg'>
      <Link href='/'>
        <h1 className='text-white text-lg text-shadow-lg'>Poor Gamblers</h1>
      </Link>
      <div className='flex min-h-[42px] items-center gap-2'>
        {loading ? (
          <div className='btn-base btn-dark pointer-events-none opacity-80'>Loading...</div>
        ) : user ? (
          <>
            <Link href='/home' className='btn-base btn-light'>
              <p>Rooms</p>
            </Link>
            <Link href='/profile' className='btn-base btn-light'>
              <p>Profile</p>
            </Link>
            <form action='/api/auth/logout' method='post' className='inline'>
              <button type='submit' className='btn-base btn-dark'>
                Logout
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href='/signup' className='btn-base btn-light'>
              <p>Sign up</p>
            </Link>

            <Link href='/signin' className='btn-base btn-dark'>
              <p>Sign in</p>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
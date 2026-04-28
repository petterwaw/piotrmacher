'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SignupPageContent() {
    const searchParams = useSearchParams()
    const error = searchParams.get('error')

    return (
        <section className='flex-1 flex items-start justify-center px-4 py-4'>
            <div className='w-full max-w-md rounded-xl bg-bg-surface p-6 shadow-lg border border-border-soft'>
                <h2 className='text-2xl font-bold text-text-main mb-1'>Sign up</h2>
                <p className='text-sm text-text-muted mb-6'>Already have an account? <Link href='/signin'><span className='text-brand font-semibold'>Sign in</span></Link></p>

                {error && (
                    <div className='mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200'>
                        {error}
                    </div>
                )}

                <form method='post' action='/api/auth/signup' className='space-y-4'>
                <div>
                    <label htmlFor='username' className='mb-1 block text-sm font-medium text-text-main'>
                    Username
                    </label>
                    <input
                    id='username'
                    name='username'
                    type='text'
                    required
                    autoComplete='username'
                    placeholder='your_username'
                    className='w-full rounded-md border border-border-soft px-3 py-2 outline-none focus:ring-2 focus:ring-brand'
                    />
                </div>

                <div>
                    <label htmlFor='email' className='mb-1 block text-sm font-medium text-text-main'>
                    Email
                    </label>
                    <input
                    id='email'
                    name='email'
                    type='email'
                    required
                    autoComplete='email'
                    placeholder='you@example.com'
                    className='w-full rounded-md border border-border-soft px-3 py-2 outline-none focus:ring-2 focus:ring-brand'
                    />
                </div>

                <div>
                    <label htmlFor='password' className='mb-1 block text-sm font-medium text-text-main'>
                    Password
                    </label>
                    <input
                    id='password'
                    name='password'
                    type='password'
                    required
                    minLength={8}
                    autoComplete='new-password'
                    placeholder='••••••••'
                    className='w-full rounded-md border border-border-soft px-3 py-2 outline-none focus:ring-2 focus:ring-brand'
                    />
                </div>

                <div>
                    <label htmlFor='confirmPassword' className='mb-1 block text-sm font-medium text-text-main'>
                    Confirm password
                    </label>
                    <input
                    id='confirmPassword'
                    name='confirmPassword'
                    type='password'
                    required
                    minLength={8}
                    autoComplete='new-password'
                    placeholder='••••••••'
                    className='w-full rounded-md border border-border-soft px-3 py-2 outline-none focus:ring-2 focus:ring-brand'
                    />
                </div>

                <button
                    type='submit'
                    className='btn-auth-submit'
                >
                    Create account
                </button>
                </form>

                <div className='my-5 flex items-center gap-3'>
                <div className='h-px flex-1 bg-border-soft' />
                <span className='text-xs text-text-muted'>OR</span>
                <div className='h-px flex-1 bg-border-soft' />
                </div>

                <a
                href='/api/auth/google?next=/home'
                className='btn-google'
                >
                <svg width='18' height='18' viewBox='0 0 48 48' aria-hidden='true'>
                    <path fill='#FFC107' d='M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z' />
                    <path fill='#FF3D00' d='M6.3 14.7l6.6 4.8C14.7 15.3 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z' />
                    <path fill='#4CAF50' d='M24 44c5.1 0 9.8-2 13.3-5.2l-6.1-5c-2 1.5-4.5 2.2-7.2 2.2-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.7 39.6 16.3 44 24 44z' />
                    <path fill='#1976D2' d='M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.2 5.4-6 6.9l.1-.1 6.1 5C35.1 40.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z' />
                </svg>
                Continue with Google
                </a>
            </div>
        </section>
    )
} 

export default function SignupPage() {
    return (
        <Suspense fallback={null}>
            <SignupPageContent />
        </Suspense>
    )
}
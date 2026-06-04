'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition, Suspense } from 'react'

type User = {
  id: string
  email: string
  username: string
} | null

type AuthMode = 'signin' | 'signup'

function LoginParamWatcher({ onLoginParam }: { onLoginParam: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledRef = useRef(false)

  useEffect(() => {
    const shouldOpenLogin = searchParams.get('login') === '1'

    if (!shouldOpenLogin) {
      handledRef.current = false
      return
    }

    if (handledRef.current) {
      return
    }

    handledRef.current = true
    onLoginParam()

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('login')
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, router, searchParams, onLoginParam])

  return null
}

export default function Header() {
  const router = useRouter()
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const [user, setUser] = useState<User | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const logoHref = user ? '/home' : '/'

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

  const resetAuthForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setUsername('')
    setAuthError(null)
    setAuthMessage(null)
  }

  const openAuthModal = (mode: AuthMode) => {
    setShowMobileUserMenu(false)
    setAuthMode(mode)
    setShowAuthModal(true)
    setAuthError(null)
    setAuthMessage(null)
  }

  const closeAuthModal = () => {
    if (isPending) return
    setShowAuthModal(false)
    resetAuthForm()
  }

  useEffect(() => {
    if (!showMobileUserMenu) {
      return
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!mobileMenuRef.current) return
      if (!mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showMobileUserMenu])

  useEffect(() => {
    if (!user) {
      setShowMobileUserMenu(false)
    }
  }, [user])

  const refreshUser = async () => {
    const response = await fetch('/api/auth/user', { cache: 'no-store' })
    const data = await response.json().catch(() => ({ user: null }))
    setUser(data.user)
  }

  const submitAuth = () => {
    setAuthError(null)
    setAuthMessage(null)

    startTransition(async () => {
      try {
        if (!email.trim() || !password) {
          throw new Error('Email and password are required.')
        }

        if (authMode === 'signup') {
          if (!username.trim()) {
            throw new Error('Username is required.')
          }

          if (password !== confirmPassword) {
            throw new Error('Passwords do not match.')
          }
        }

        const endpoint = authMode === 'signin' ? '/api/auth/signin' : '/api/auth/signup'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
            confirmPassword,
            username: username.trim(),
          }),
        })

        const data = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          throw new Error(data.error || 'Authentication failed.')
        }

        if (authMode === 'signup') {
          setAuthMessage('Account created! Check your email and click the confirmation link before signing in.')
          resetAuthForm()
          return
        }

        await refreshUser()
        setShowAuthModal(false)
        resetAuthForm()
        router.push('/home')
        router.refresh()
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Authentication failed.')
      }
    })
  }

  const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="text-text-main">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.796 2.7164v2.2582h2.9087c1.7018-1.5668 2.6837-3.875 2.6837-6.6155Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1791l-2.9087-2.2582c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5827-5.0368-3.7105H.9573v2.3318A9.0001 9.0001 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.9632 10.7105A5.4108 5.4108 0 0 1 3.6818 9c0-.5932.1023-1.1686.2814-1.7105V4.9577H.9573A9.0001 9.0001 0 0 0 0 9c0 1.4523.3482 2.8277.9573 4.0423l3.0059-2.3318Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.3454l2.5814-2.5813C13.4632.8918 11.4268 0 9 0A9.0001 9.0001 0 0 0 .9573 4.9577l3.0059 2.3318C4.6718 5.1614 6.6559 3.5795 9 3.5795Z"
      />
    </svg>
  )

  const handleOpenLoginFromParam = useCallback(() => {
    if (!loading && !user) {
      setAuthMode('signin')
      setShowAuthModal(true)
    }
  }, [loading, user])

  return (
    <>
      <Suspense fallback={null}>
        <LoginParamWatcher onLoginParam={handleOpenLoginFromParam} />
      </Suspense>
      <header className="w-full px-4 pt-2 md:px-6 md:pt-4">
        <div className="mx-auto hidden max-w-[1320px] border border-white/40 bg-white/80 shadow-sm backdrop-blur md:block">
          <div className="min-h-[64px] items-center justify-between px-6 md:flex">
            <div className="flex items-center gap-8">
              <Link href={logoHref} className="text-[38px] font-black italic tracking-tight text-[#4CAF50]">
                PIOTRMACHER
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {loading ? (
                <div className="bg-gray-100 px-4 py-2 text-sm text-text-muted">Loading...</div>
              ) : user ? (
                <>
                  <Link href="/profile" className="inline-flex h-10 w-10 items-center justify-center border border-gray-200 bg-white hover:border-brand hover:bg-gray-50">
                    <UserIcon />
                  </Link>
                  <form action="/api/auth/logout" method="post" className="inline">
                    <button type="submit" className="border border-[#4CAF50] bg-[#4CAF50] px-5 py-2 text-sm font-semibold text-white hover:bg-[#81C784] hover:border-[#81C784]">
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text-main hover:border-brand hover:bg-gray-50"
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin')}
                    className="border border-[#4CAF50] bg-[#4CAF50] px-5 py-2 text-sm font-semibold text-white hover:bg-[#81C784] hover:border-[#81C784]"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>

        </div>

        <div className="mx-auto flex max-w-[1320px] min-h-[56px] items-center justify-between px-3 md:hidden">
<Link href={logoHref} className="text-[30px] font-black italic tracking-tight text-[#4CAF50]">
            PIOTRMACHER
          </Link>

          <div className="relative" ref={mobileMenuRef}>
            {loading ? null : user ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowMobileUserMenu((prev) => !prev)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                >
                  <UserIcon />
                </button>

                {showMobileUserMenu ? (
                  <div className="absolute right-0 top-11 z-20 w-40 border-2 border-zinc-300 bg-white shadow-md">
                    <Link
                      href="/profile"
                      onClick={() => setShowMobileUserMenu(false)}
                      className="block px-4 py-3 text-sm font-medium text-text-main hover:bg-gray-50"
                    >
                      Account
                    </Link>
                    <form action="/api/auth/logout" method="post" className="border-t border-border-soft">
                      <button
                        type="submit"
                        className="w-full px-4 py-3 text-left text-sm font-medium text-text-main hover:bg-gray-50"
                      >
                        Logout
                      </button>
                    </form>
                  </div>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
              >
                <UserIcon />
              </button>
            )}
          </div>
        </div>
      </header>

      {showAuthModal ? (
        <div className="fixed inset-0 z-[100] bg-black/45 px-3 md:flex md:items-center md:justify-center">
          <div className="absolute inset-0" onClick={closeAuthModal} />

          <div className="fixed bottom-0 left-0 right-0 z-[101] bg-white p-5 shadow-2xl md:static md:w-full md:max-w-md md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[44px] font-black italic leading-none tracking-tight text-[#4CAF50]">PIOTRMACHER</h3>
              <button
                type="button"
                onClick={closeAuthModal}
                className="inline-flex h-8 w-8 items-center justify-center border border-gray-300 bg-white text-lg text-text-muted hover:border-brand hover:bg-gray-50"
              >
                x
              </button>
            </div>

            <div className="mb-4 flex bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                className={`flex-1 px-3 py-2 text-sm font-semibold ${authMode === 'signin' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted'}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`flex-1 px-3 py-2 text-sm font-semibold ${authMode === 'signup' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted'}`}
              >
                Register
              </button>
            </div>

            {authMode === 'signup' ? (
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                className="mb-3 w-full border-2 border-zinc-300 bg-gray-50 px-4 py-3 outline-none focus:border-[#66BB6A]"
              />
            ) : null}

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-mail"
              className="mb-3 w-full border-2 border-zinc-300 bg-gray-50 px-4 py-3 outline-none focus:border-[#66BB6A]"
            />

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="mb-3 w-full border-2 border-zinc-300 bg-gray-50 px-4 py-3 outline-none focus:border-[#66BB6A]"
            />

            {authMode === 'signup' ? (
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm password"
                className="mb-3 w-full border-2 border-zinc-300 bg-gray-50 px-4 py-3 outline-none focus:border-[#66BB6A]"
              />
            ) : null}

            {authError ? <p className="mb-2 text-sm text-[#E8541E]">{authError}</p> : null}
            {authMessage ? <p className="mb-2 text-sm text-green-700">{authMessage}</p> : null}

            <button
              type="button"
              onClick={submitAuth}
              disabled={isPending}
              className="mt-2 w-full border border-[#4CAF50] bg-[#4CAF50] px-4 py-3 text-lg font-semibold text-white hover:bg-[#81C784] hover:border-[#81C784] disabled:opacity-70"
            >
              {isPending ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            <a
              href="/api/auth/google?next=/home"
              className="mt-3 inline-flex w-full items-center justify-center border-2 border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-text-main hover:bg-gray-50 hover:border-brand"
            >
              <GoogleIcon />
              <span className="ml-2">Continue with Google</span>
            </a>
          </div>
        </div>
      ) : null}
    </>
  )
}
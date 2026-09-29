'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition, Suspense } from 'react'
import { usePresence } from '@/app/components/motion/usePresence'
import { safeRedirectPath } from '@/app/utils/auth/safeRedirectPath'
import { OPEN_AUTH_EVENT, type OpenAuthDetail } from '@/app/utils/share/invite'
import { useDialogFocus } from '@/app/components/a11y/useDialogFocus'

type User = {
  id: string
  email: string
  username: string
} | null

type AuthMode = 'signin' | 'signup'

type AuthRequest = { mode: AuthMode; next: string | null; context: string | null }

// `?login=1[&next=/path]` opens the sign-in sheet (the proxy sends logged-out
// visitors of /home here). Both params are consumed from the URL.
function LoginParamWatcher({ onLoginParam }: { onLoginParam: (next: string | null) => void }) {
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
    onLoginParam(searchParams.get('next'))

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('login')
    nextParams.delete('next')
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, router, searchParams, onLoginParam])

  return null
}

export default function Header() {
  const router = useRouter()
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const authDialogRef = useRef<HTMLDivElement | null>(null)
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
  // Where to go after signing in (e.g. back to an invite link) and a short
  // line explaining why the sheet opened. Null = the usual /home.
  const [authNext, setAuthNext] = useState<string | null>(null)
  const [authContext, setAuthContext] = useState<string | null>(null)
  // An auth request that arrived before we knew whether the user is signed in.
  const [pendingAuth, setPendingAuth] = useState<AuthRequest | null>(null)
  const postLoginPath = safeRedirectPath(authNext)
  const logoHref = user ? '/home' : '/'
  // Overlays stay mounted for their exit animation.
  const authPresence = usePresence(showAuthModal)
  const menuPresence = usePresence(showMobileUserMenu)

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
    setAuthNext(null)
    setAuthContext(null)
    resetAuthForm()
  }

  useEffect(() => {
    const handleOpenAuth = (event: Event) => {
      const detail = (event as CustomEvent<OpenAuthDetail>).detail ?? {}
      setPendingAuth({
        mode: detail.mode ?? 'signin',
        next: detail.next ?? null,
        context: detail.context ?? null,
      })
    }
    window.addEventListener(OPEN_AUTH_EVENT, handleOpenAuth)
    return () => window.removeEventListener(OPEN_AUTH_EVENT, handleOpenAuth)
  }, [])

  // Open queued requests once the session check is done (never for a user
  // who is already signed in).
  useEffect(() => {
    if (!pendingAuth || loading) return
    setPendingAuth(null)
    if (user) return
    setShowMobileUserMenu(false)
    setAuthMode(pendingAuth.mode)
    setAuthNext(pendingAuth.next ? safeRedirectPath(pendingAuth.next) : null)
    setAuthContext(pendingAuth.context)
    setAuthError(null)
    setAuthMessage(null)
    setShowAuthModal(true)
  }, [pendingAuth, loading, user])

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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMobileUserMenu(false)
        mobileMenuButtonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
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

  const submitAuth = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (isPending) return
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
        setAuthNext(null)
        setAuthContext(null)
        resetAuthForm()
        router.push(postLoginPath)
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

  // Focus moves into the dialog and stays there; Escape closes it and focus
  // returns to the control that opened it.
  useDialogFocus(authDialogRef, showAuthModal, closeAuthModal)

  const handleOpenLoginFromParam = useCallback((next: string | null) => {
    setPendingAuth({ mode: 'signin', next, context: null })
  }, [])

  const inputClassName =
    'mb-3 min-h-12 w-full border-2 border-zinc-300 bg-gray-50 px-4 py-3 text-base text-text-main outline-none transition-colors placeholder:text-zinc-500 focus:border-brand focus:bg-white'

  const segmentClassName = (active: boolean) =>
    `flex-1 min-h-10 px-3 py-2 text-sm font-semibold transition-colors ${
      active ? 'bg-white text-text-main shadow-sm' : 'text-zinc-600 hover:text-text-main'
    }`

  return (
    <>
      <Suspense fallback={null}>
        <LoginParamWatcher onLoginParam={handleOpenLoginFromParam} />
      </Suspense>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:inline-flex focus:min-h-11 focus:items-center focus:border-2 focus:border-brand focus:bg-white focus:px-4 focus:text-sm focus:font-semibold focus:text-text-main"
      >
        Skip to content
      </a>
      <header className="w-full px-4 pt-2 md:px-6 md:pt-4">
        <div className="mx-auto hidden max-w-[1320px] border border-white/40 bg-white/80 shadow-sm backdrop-blur md:block">
          <div className="min-h-[64px] items-center justify-between px-6 md:flex">
            <div className="flex items-center gap-8">
              <Link href={logoHref} className="text-[38px] font-black italic leading-none tracking-tight text-brand-bright transition-colors hover:text-brand">
                PIOTRMACHER
              </Link>
            </div>

            <div className="flex min-h-10 items-center gap-2">
              {loading ? (
                <div aria-hidden="true" className="flex items-center gap-2">
                  <div className="h-10 w-10 bg-zinc-200/80 motion-safe:animate-pulse" />
                  <div className="h-10 w-24 bg-zinc-200/80 motion-safe:animate-pulse" />
                </div>
              ) : user ? (
                <div className="animate-overlay-in flex items-center gap-2">
                  <Link
                    href="/profile"
                    aria-label="Account"
                    title="Account"
                    className="press inline-flex h-10 w-10 items-center justify-center border border-gray-300 bg-white transition-colors hover:border-brand hover:bg-brand-tint"
                  >
                    <UserIcon />
                  </Link>
                  <form action="/api/auth/logout" method="post" className="inline">
                    <button type="submit" className="min-h-10 border border-brand bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover hover:border-brand-hover">
                      Logout
                    </button>
                  </form>
                </div>
              ) : (
                <div className="animate-overlay-in flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="min-h-10 border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-text-main transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand"
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin')}
                    className="min-h-10 border border-brand bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover hover:border-brand-hover"
                  >
                    Sign in
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="mx-auto flex max-w-[1320px] min-h-[56px] items-center justify-between px-3 md:hidden">
          <Link href={logoHref} className="text-[30px] font-black italic leading-none tracking-tight text-brand-bright">
            PIOTRMACHER
          </Link>

          <div className="relative flex h-11 w-11 items-center justify-center" ref={mobileMenuRef}>
            {loading ? (
              <div aria-hidden="true" className="h-11 w-11 rounded-full bg-zinc-200/80 motion-safe:animate-pulse" />
            ) : user ? (
              <>
                <button
                  ref={mobileMenuButtonRef}
                  type="button"
                  onClick={() => setShowMobileUserMenu((prev) => !prev)}
                  aria-label="Account menu"
                  aria-expanded={showMobileUserMenu}
                  aria-controls="mobile-account-menu"
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                    showMobileUserMenu ? 'bg-brand-tint ring-2 ring-brand' : 'bg-white/80 ring-1 ring-zinc-300 active:bg-zinc-100'
                  }`}
                >
                  <UserIcon />
                </button>

                {menuPresence.value ? (
                  <div id="mobile-account-menu" className={`${menuPresence.isClosing ? 'animate-pop-out' : 'animate-pop-in'} absolute right-0 top-[calc(100%+6px)] z-20 w-48 border-2 border-zinc-300 bg-white shadow-lg shadow-black/10`}>
                    <Link
                      href="/profile"
                      onClick={() => setShowMobileUserMenu(false)}
                      className="no-press flex min-h-12 items-center px-4 text-sm font-semibold text-text-main transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                    >
                      Account
                    </Link>
                    <form action="/api/auth/logout" method="post" className="border-t border-border-soft">
                      <button
                        type="submit"
                        className="no-press flex min-h-12 w-full items-center px-4 text-left text-sm font-semibold text-text-main transition-colors hover:bg-zinc-50 active:bg-zinc-100"
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
                aria-label="Sign in"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 ring-1 ring-zinc-300 transition-colors active:bg-zinc-100"
              >
                <UserIcon />
              </button>
            )}
          </div>
        </div>
      </header>

      {authPresence.value ? (
        <div className={`fixed inset-0 z-[100] bg-black/50 md:flex md:items-center md:justify-center md:px-4 ${authPresence.isClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`}>
          <div className="absolute inset-0" onClick={closeAuthModal} aria-hidden="true" />

          <div
            ref={authDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            tabIndex={-1}
            className={`${authPresence.isClosing ? 'animate-sheet-out md:animate-dialog-out' : 'animate-sheet-in md:animate-dialog-in'} fixed bottom-0 left-0 right-0 z-[101] max-h-[calc(100dvh-1rem)] overflow-y-auto border-t-2 border-zinc-300 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl md:static md:w-full md:max-w-md md:border-2 md:p-6`}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <p aria-hidden="true" className="text-[40px] font-black italic leading-none tracking-tight text-brand-bright md:text-[44px]">PIOTRMACHER</p>
              <h2 id="auth-dialog-title" className="sr-only">{authMode === 'signin' ? 'Sign in to Piotrmacher' : 'Register for Piotrmacher'}</h2>
              <button
                type="button"
                onClick={closeAuthModal}
                aria-label="Close"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-gray-300 bg-white text-text-muted transition-colors hover:border-brand hover:text-brand"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {authContext ? (
              <p className="mb-4 border-l-4 border-brand bg-brand-tint px-3 py-2 text-sm font-semibold text-text-main">
                {authContext}
              </p>
            ) : null}

            <div className="mb-4 flex bg-gray-100 p-1" role="group" aria-label="Account">
              <button
                type="button"
                onClick={() => setAuthMode('signin')}
                aria-pressed={authMode === 'signin'}
                className={segmentClassName(authMode === 'signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                aria-pressed={authMode === 'signup'}
                className={segmentClassName(authMode === 'signup')}
              >
                Register
              </button>
            </div>

            <form onSubmit={submitAuth} noValidate>
            {authMode === 'signup' ? (
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
                aria-label="Username"
                aria-describedby={authError ? 'auth-error' : undefined}
                autoComplete="username"
                className={inputClassName}
              />
            ) : null}

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-mail"
              aria-label="E-mail"
              data-autofocus
              aria-describedby={authError ? 'auth-error' : undefined}
              autoComplete="email"
              className={inputClassName}
            />

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
              aria-describedby={authError ? 'auth-error' : undefined}
              autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
              className={inputClassName}
            />

            {authMode === 'signup' ? (
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm password"
                aria-label="Confirm password"
                aria-describedby={authError ? 'auth-error' : undefined}
                autoComplete="new-password"
                className={inputClassName}
              />
            ) : null}

            {authError ? <p id="auth-error" role="alert" className="animate-message-in mb-2 text-sm font-medium text-danger">{authError}</p> : null}
            {authMessage ? <p role="status" className="animate-message-in mb-2 text-sm font-medium text-brand">{authMessage}</p> : null}

            <button
              type="submit"
              disabled={isPending}
              className="press-soft mt-2 min-h-12 w-full border border-brand bg-brand px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-hover hover:border-brand-hover disabled:opacity-60 disabled:hover:bg-brand"
            >
              {isPending ? 'Please wait…' : authMode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-500" aria-hidden="true">
              <span className="h-px flex-1 bg-zinc-200" />
              or
              <span className="h-px flex-1 bg-zinc-200" />
            </div>

            <a
              href={`/api/auth/google?next=${encodeURIComponent(postLoginPath)}`}
              className="press press-soft inline-flex min-h-12 w-full items-center justify-center border-2 border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-text-main transition-colors hover:bg-zinc-50 hover:border-brand"
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

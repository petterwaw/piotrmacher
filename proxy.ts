import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPrefixes = ['/home']

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Browsers always send Origin on cross-site POST/PATCH/DELETE; reject those so
// cookie-authenticated API routes can't be driven from another site (CSRF).
// Requests without Origin (server-to-server, e.g. the pg_cron tick) pass.
function isCrossSiteWrite(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return false
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    if (isCrossSiteWrite(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next()
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Refresh + persist the session cookie on every navigable page (not just
  // /home) so a rotated refresh token is never left stale in the browser.
  // Without this, hitting `/` directly with an expired access token can
  // trigger a silent refresh in a Server Component (which can't persist
  // cookies), consuming the rotated refresh token without saving the new
  // one — the very next /home request then fails to refresh and bounces
  // the user back to the login screen even though they never logged out.
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('login', '1')
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

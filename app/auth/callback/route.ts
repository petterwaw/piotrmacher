import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next') || '/home'

  if (!code) {
    const signinUrl = new URL('/signin', request.url)
    signinUrl.searchParams.set('error', 'Missing OAuth code')
    return NextResponse.redirect(signinUrl)
  }

  try {
    const supabase = await createServerSupabaseClient()
    const serviceSupabase = createServiceRoleSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      const signinUrl = new URL('/signin', request.url)
      signinUrl.searchParams.set('error', error.message)
      return NextResponse.redirect(signinUrl)
    }

    // For Google OAuth users, default username = email prefix.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.email && user.app_metadata?.provider === 'google') {
      const emailPrefixRaw = user.email.split('@')[0]
      const emailPrefix = emailPrefixRaw.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 24) || 'user'
      const currentUsername = user.user_metadata?.username

      if (emailPrefix && currentUsername !== emailPrefix) {
        let candidate = emailPrefix
        for (let i = 0; i < 20; i += 1) {
          const { data: existing } = await serviceSupabase
            .from('profiles')
            .select('id')
            .ilike('username', candidate)
            .neq('id', user.id)
            .limit(1)
            .maybeSingle()

          if (!existing?.id) break
          const suffix = String(i + 2)
          const base = emailPrefix.slice(0, Math.max(3, 24 - suffix.length))
          candidate = `${base}${suffix}`
        }

        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            username: candidate,
          },
        })

        if (updateError) {
          console.error('Username sync error:', updateError)
        }
      }
    }

    return NextResponse.redirect(new URL(next, request.url))
  } catch (err) {
    console.error('OAuth callback error:', err)
    const signinUrl = new URL('/signin', request.url)
    signinUrl.searchParams.set('error', 'OAuth callback failed')
    return NextResponse.redirect(signinUrl)
  }
}

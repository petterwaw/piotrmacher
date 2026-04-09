import { createServerSupabaseClient } from '@/app/utils/supabase/server'
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
      const emailPrefix = user.email.split('@')[0]
      const currentUsername = user.user_metadata?.username

      if (emailPrefix && currentUsername !== emailPrefix) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            username: emailPrefix,
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

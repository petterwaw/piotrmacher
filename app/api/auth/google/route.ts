import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') || '/home'

  try {
    const supabase = await createServerSupabaseClient()
    const callbackUrl = new URL('/auth/callback', request.url)
    callbackUrl.searchParams.set('next', next)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error || !data.url) {
      const signinUrl = new URL('/signin', request.url)
      signinUrl.searchParams.set('error', error?.message || 'Google sign-in failed')
      return NextResponse.redirect(signinUrl)
    }

    return NextResponse.redirect(data.url)
  } catch (err) {
    console.error('Google OAuth init error:', err)
    const signinUrl = new URL('/signin', request.url)
    signinUrl.searchParams.set('error', 'Google sign-in failed')
    return NextResponse.redirect(signinUrl)
  }
}

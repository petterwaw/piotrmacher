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
      return NextResponse.redirect(new URL('/home', request.url))
    }

    return NextResponse.redirect(data.url)
  } catch (err) {
    console.error('Google OAuth init error:', err)
    return NextResponse.redirect(new URL('/home', request.url))
  }
}

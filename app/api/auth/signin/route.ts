import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const wantsJson = request.headers.get('accept')?.includes('application/json')
  const contentType = request.headers.get('content-type') || ''

  let email = ''
  let password = ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null
    email = body?.email?.trim() || ''
    password = body?.password || ''
  } else {
    const formData = await request.formData()
    email = (formData.get('email') as string) || ''
    password = (formData.get('password') as string) || ''
  }

  if (!email || !password) {
    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    return NextResponse.redirect(
      new URL('/signin?error=' + encodeURIComponent('Email and password are required'), request.url)
    )
  }

  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.log('Sign in error:', { error: error.message, email })

      if (wantsJson || contentType.includes('application/json')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.redirect(
        new URL('/signin?error=' + encodeURIComponent(error.message), request.url)
      )
    }

    if (!data.session) {
      console.log('No session created')

      if (wantsJson || contentType.includes('application/json')) {
        return NextResponse.json({ error: 'No session created' }, { status: 400 })
      }

      return NextResponse.redirect(
        new URL('/signin?error=' + encodeURIComponent('No session created'), request.url)
      )
    }

    console.log('Sign in successful:', { user: data.user })

    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.redirect(new URL('/home', request.url))
  } catch (err) {
    console.error('Sign in catch error:', err)

    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.redirect(
      new URL('/signin?error=' + encodeURIComponent('Internal server error'), request.url)
    )
  }
}

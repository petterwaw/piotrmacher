import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const wantsJson = request.headers.get('accept')?.includes('application/json')
  const contentType = request.headers.get('content-type') || ''

  let email = ''
  let password = ''
  let confirmPassword = ''
  let username = ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as {
      email?: string
      password?: string
      confirmPassword?: string
      username?: string
    } | null

    email = body?.email?.trim() || ''
    password = body?.password || ''
    confirmPassword = body?.confirmPassword || ''
    username = body?.username || ''
  } else {
    const formData = await request.formData()
    email = (formData.get('email') as string) || ''
    password = (formData.get('password') as string) || ''
    confirmPassword = (formData.get('confirmPassword') as string) || ''
    username = (formData.get('username') as string) || ''
  }

  const normalizedUsername = username?.trim()

  if (!email || !password || !confirmPassword || !normalizedUsername) {
    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('All fields are required'), request.url)
    )
  }

  if (!/^[a-zA-Z0-9_.]{3,24}$/.test(normalizedUsername)) {
    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Username must be 3-24 chars: letters, numbers, _ or .' }, { status: 400 })
    }

    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('Username must be 3-24 chars: letters, numbers, _ or .'), request.url)
    )
  }

  if (password !== confirmPassword) {
    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('Passwords do not match'), request.url)
    )
  }

  if (password.length < 8) {
    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('Password must be at least 8 characters'), request.url)
    )
  }

  try {
    const serviceSupabase = createServiceRoleSupabaseClient()
    const { data: existingProfile } = await serviceSupabase
      .from('profiles')
      .select('id')
      .ilike('username', normalizedUsername)
      .limit(1)
      .maybeSingle()

    if (existingProfile?.id) {
      if (wantsJson || contentType.includes('application/json')) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
      }

      return NextResponse.redirect(
        new URL('/signup?error=' + encodeURIComponent('Username already exists'), request.url)
      )
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: normalizedUsername,
        },
      },
    })

    if (error) {
      console.log('Sign up error:', { error: error.message, email, username: normalizedUsername })

      if (wantsJson || contentType.includes('application/json')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.redirect(
        new URL('/signup?error=' + encodeURIComponent(error.message), request.url)
      )
    }

    console.log('Sign up successful:', { user: data.user })

    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ ok: true })
    }

    return NextResponse.redirect(new URL('/home', request.url))
  } catch (err) {
    console.error('Sign up catch error:', err)

    if (wantsJson || contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('Internal server error'), request.url)
    )
  }
}

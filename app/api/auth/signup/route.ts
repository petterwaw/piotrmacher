import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const username = formData.get('username') as string

  if (!email || !password || !confirmPassword || !username) {
    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('All fields are required'), request.url)
    )
  }

  if (password !== confirmPassword) {
    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('Passwords do not match'), request.url)
    )
  }

  if (password.length < 8) {
    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('Password must be at least 8 characters'), request.url)
    )
  }

  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    })

    if (error) {
      console.log('Sign up error:', { error: error.message, email, username })
      return NextResponse.redirect(
        new URL('/signup?error=' + encodeURIComponent(error.message), request.url)
      )
    }

    console.log('Sign up successful:', { user: data.user })
    return NextResponse.redirect(new URL('/home', request.url))
  } catch (err) {
    console.error('Sign up catch error:', err)
    return NextResponse.redirect(
      new URL('/signup?error=' + encodeURIComponent('Internal server error'), request.url)
    )
  }
}

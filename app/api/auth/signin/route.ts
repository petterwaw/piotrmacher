import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
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
      return NextResponse.redirect(
        new URL('/signin?error=' + encodeURIComponent(error.message), request.url)
      )
    }

    if (!data.session) {
      console.log('No session created')
      return NextResponse.redirect(
        new URL('/signin?error=' + encodeURIComponent('No session created'), request.url)
      )
    }

    console.log('Sign in successful:', { user: data.user })
    return NextResponse.redirect(new URL('/home', request.url))
  } catch (err) {
    console.error('Sign in catch error:', err)
    return NextResponse.redirect(
      new URL('/signin?error=' + encodeURIComponent('Internal server error'), request.url)
    )
  }
}

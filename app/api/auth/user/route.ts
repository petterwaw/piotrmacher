import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username || 'User',
      },
    })
  } catch (err) {
    console.error('Get user error:', err)
    return NextResponse.json({ user: null })
  }
}

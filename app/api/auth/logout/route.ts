import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return NextResponse.redirect(new URL('/', request.url))
    }

    console.log('Logout successful')
    return NextResponse.redirect(new URL('/', request.url))
  } catch (err) {
    console.error('Logout catch error:', err)
    return NextResponse.redirect(new URL('/', request.url))
  }
}

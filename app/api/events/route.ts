import { getActiveEvents } from '@/app/utils/events/getActiveEvents'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // The list is served from a shared service-role cache, so keep the old
    // RLS semantics (events are readable by authenticated users only).
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ events: [] })
    }

    const events = await getActiveEvents()
    return NextResponse.json({ events })
  } catch {
    return NextResponse.json({ events: [] })
  }
}

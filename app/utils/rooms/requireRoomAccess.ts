import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'

// RLS on `rooms` only returns rows to the host and members, so a missing row
// means the viewer has no access. Use before any service-role read of room data.
export const requireRoomAccess = cache(async (roomId: string) => {
  const supabase = await createServerSupabaseClient()
  const { data: room } = await supabase.from('rooms').select('id').eq('id', roomId).maybeSingle()

  if (!room) {
    notFound()
  }
})

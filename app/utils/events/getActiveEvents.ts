import { createServerSupabaseClient } from '@/app/utils/supabase/server'

export type ActiveEventOption = {
  id: string
  name: string
  season: string
  displayName: string
}

export async function getActiveEvents(): Promise<ActiveEventOption[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('events')
    .select('id, name, season')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !data) {
    return []
  }

  return data.map((event) => ({
    id: event.id,
    name: event.name,
    season: event.season,
    displayName: `${event.name} (${event.season})`,
  }))
}
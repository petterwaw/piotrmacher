import type { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { ESPN_PROVIDER, hasEspnFixturesBetween } from '@/app/utils/providers/espn'

type ServiceSupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>

// Long enough to span a league's summer break or a Nations League gap.
const LOOKAHEAD_MS = 180 * 24 * 60 * 60 * 1000

export async function deactivateFinishedEvents(supabase: ServiceSupabaseClient) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, provider_event_id')
    .eq('provider', ESPN_PROVIDER)
    .eq('is_active', true)

  if (error) {
    return { ok: false as const, error: 'Could not load active events.' }
  }

  const now = new Date()
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const to = new Date(now.getTime() + LOOKAHEAD_MS)
  const toDeactivate: string[] = []
  const skipped: Array<{ eventId: string; reason: string }> = []

  for (const event of events ?? []) {
    if (!event.provider_event_id) continue

    try {
      const hasFixtures = await hasEspnFixturesBetween(event.provider_event_id, from, to)
      if (!hasFixtures) toDeactivate.push(event.id)
    } catch (fetchError) {
      skipped.push({
        eventId: event.id,
        reason: fetchError instanceof Error ? fetchError.message : 'Provider request failed',
      })
    }
  }

  if (toDeactivate.length > 0) {
    const { error: updateError } = await supabase
      .from('events')
      .update({ is_active: false })
      .in('id', toDeactivate)

    if (updateError) {
      return { ok: false as const, error: 'Could not deactivate finished events.' }
    }
  }

  return { ok: true as const, checked: (events ?? []).length, deactivated: toDeactivate.length, skipped }
}

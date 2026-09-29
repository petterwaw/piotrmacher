import 'server-only'
import { getActiveEventsCached, type CachedActiveEvent } from '@/app/utils/cache/sharedReads'

export type ActiveEventOption = CachedActiveEvent

// Shared cached list (tag `events:active`). Events are readable by any
// authenticated user; callers must have an authenticated user before calling.
export async function getActiveEvents(): Promise<ActiveEventOption[]> {
  return getActiveEventsCached()
}

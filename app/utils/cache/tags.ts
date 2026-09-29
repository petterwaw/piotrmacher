import 'server-only'
import { revalidateTag } from 'next/cache'

// Cache tags for the shared (cross-user) reads in ./sharedReads.ts.
// Every tag that guards room data carries the room id, and every tag that
// guards event data carries the event id, so invalidation is always scoped.
export const cacheTags = {
  // Scheduled / delayed / live matches of an event (fixtures + live state).
  eventFixtures: (eventId: string) => `event:${eventId}:fixtures`,
  // Finished matches of an event (results shown in room history).
  eventResults: (eventId: string) => `event:${eventId}:results`,
  // Room leaderboard (room_players.points + member usernames).
  roomStandings: (roomId: string) => `room:${roomId}:standings`,
  // Other members' predictions (+ points) for started matches of a room.
  roomBets: (roomId: string) => `room:${roomId}:bets`,
  // Events with is_active = true (event picker).
  activeEvents: 'events:active',
  // Any cached entry that embeds usernames or per-user rows across rooms.
  users: 'users',
} as const

// Expire immediately (no stale-while-revalidate): the next read after a write
// or a tick is a blocking cache miss, so results/standings are never one
// request behind. Only callable from Route Handlers / Server Actions; errors are
// logged instead of failing the mutation that already succeeded.
export function invalidateCacheTags(tags: Iterable<string>) {
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag, { expire: 0 })
    } catch (error) {
      console.error(`[cache] Could not revalidate tag ${tag}:`, error)
    }
  }
}

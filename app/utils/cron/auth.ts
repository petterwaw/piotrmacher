import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value: string) {
  return createHash('sha256').update(value).digest()
}

// Fails closed when CRON_SECRET is not configured.
export function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const provided = request.headers.get('authorization') ?? ''
  return timingSafeEqual(digest(provided), digest(`Bearer ${secret}`))
}

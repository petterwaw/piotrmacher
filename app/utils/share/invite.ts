// Invite links: https://piotrmacher.fun/join/<code>. The code itself is the
// secret, so nothing here (or in the /join page metadata) may describe the
// room beyond what the host chooses to write in their own message.

export const SITE_URL = 'https://piotrmacher.fun'
export const SITE_NAME = 'Piotrmacher'

// Matches what POST /api/rooms/join accepts (4-32 chars, compared lowercase).
// Codes are hex today; allow alphanumerics so older codes keep working.
const INVITE_CODE_PATTERN = /^[a-z0-9]{4,32}$/

export function normalizeInviteCode(raw: string | null | undefined) {
  if (typeof raw !== 'string') return null
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    return null
  }
  const code = value.trim().toLowerCase()
  return INVITE_CODE_PATTERN.test(code) ? code : null
}

export function invitePath(code: string) {
  return `/join/${encodeURIComponent(code.toLowerCase())}`
}

export function inviteUrl(code: string, origin: string = SITE_URL) {
  return `${origin.replace(/\/$/, '')}${invitePath(code)}`
}

export function formatInviteCode(code: string) {
  return code.toUpperCase()
}

export function inviteMessage(code: string, eventName?: string | null) {
  const event = eventName?.trim()
  const room = event ? `my ${event} room` : 'my prediction room'
  return `Join ${room} on ${SITE_NAME} — code ${formatInviteCode(code)}`
}

// Remembers an invite across sign-up + e-mail confirmation, which can't carry
// a `next` parameter. Best effort: storage may be unavailable.
const PENDING_INVITE_KEY = 'piotrmacher:pending-invite'

export function rememberPendingInvite(code: string) {
  try {
    window.localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ code, at: Date.now() }))
  } catch {}
}

export function readPendingInvite(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    const raw = window.localStorage.getItem(PENDING_INVITE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { code?: unknown; at?: unknown }
    const code = normalizeInviteCode(typeof parsed.code === 'string' ? parsed.code : null)
    if (!code || typeof parsed.at !== 'number' || Date.now() - parsed.at > maxAgeMs) {
      window.localStorage.removeItem(PENDING_INVITE_KEY)
      return null
    }
    return code
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    window.localStorage.removeItem(PENDING_INVITE_KEY)
  } catch {}
}

// Opens the header's sign-in sheet from anywhere, optionally with a post-login
// target. The header sanitises `next` with safeRedirectPath.
export const OPEN_AUTH_EVENT = 'piotrmacher:open-auth'

export type OpenAuthDetail = { mode?: 'signin' | 'signup'; next?: string; context?: string }

export function openAuth(detail: OpenAuthDetail) {
  window.dispatchEvent(new CustomEvent<OpenAuthDetail>(OPEN_AUTH_EVENT, { detail }))
}

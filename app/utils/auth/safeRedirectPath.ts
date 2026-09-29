// Only allow same-origin relative paths ("/home", "/home/abc?x=1") as
// post-login targets; anything else ("//evil.tld", "https://evil.tld") falls back.
export function safeRedirectPath(next: string | null, fallback = '/home') {
  if (!next || !next.startsWith('/') || /[\\\u0000-\u001f]/.test(next)) {
    return fallback
  }

  // The URL parser is the source of truth for what the browser will do.
  const base = 'https://same-origin.invalid'
  try {
    const resolved = new URL(next, base)
    // Dot segments can collapse "/.//evil.tld" into the protocol-relative "//evil.tld".
    if (resolved.origin !== base || resolved.pathname.startsWith('//')) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}

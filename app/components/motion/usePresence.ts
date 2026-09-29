'use client'

import { useEffect, useState } from 'react'

/** Matches --dur-fast, the length of every exit animation. */
export const EXIT_MS = 150

/**
 * Keeps an overlay mounted for its exit animation.
 *
 * Pass the "open" value (a boolean, or the thing being shown, e.g. a modal
 * mode). While it is set, `value` mirrors it. When it clears, the last value
 * is latched for `exitMs` with `isClosing: true` so the element can play its
 * exit animation, then `value` becomes null and the element unmounts.
 */
export function usePresence<T>(current: T | null | undefined | false, exitMs: number = EXIT_MS) {
  const [latched, setLatched] = useState<T | null>(current || null)

  // Adjust state while rendering (React's recommended pattern for derived state).
  if (current && current !== latched) {
    setLatched(current)
  }

  const isClosing = !current && latched !== null

  useEffect(() => {
    if (!isClosing) return
    const timer = window.setTimeout(() => setLatched(null), exitMs)
    return () => window.clearTimeout(timer)
  }, [isClosing, exitMs])

  return {
    value: (current || latched || null) as T | null,
    isClosing,
  }
}

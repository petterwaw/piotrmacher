'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)'
/** Matches --dur-base. */
const DURATION_MS = 220

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * FLIP reorder: children of `containerRef` marked with `data-flip-key` glide
 * from their previous position to the new one when `trigger` changes (e.g.
 * the joined order of ids). Positions are relative to the container, so
 * scrolling between renders does not cause false moves. Transform only.
 */
export function useFlipReorder(containerRef: RefObject<HTMLElement | null>, trigger: string) {
  const positions = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-key]'))
    const previous = positions.current
    const next = new Map<string, number>()
    const reduce = prefersReducedMotion()

    for (const item of items) {
      const key = item.dataset.flipKey as string
      const top = item.offsetTop
      next.set(key, top)

      const before = previous.get(key)
      if (reduce || before === undefined || before === top) continue

      item.animate(
        [{ transform: `translateY(${before - top}px)` }, { transform: 'none' }],
        { duration: DURATION_MS, easing: EASE_OUT_EXPO }
      )
    }

    positions.current = next
  }, [containerRef, trigger])
}

/**
 * Smooth height change for a box whose content swaps (e.g. score -> score
 * steppers). When `trigger` changes, the box animates from its previous
 * height to the new one instead of jumping. Only runs on that trigger, so
 * data refreshes never animate.
 */
export function useSmoothHeight(ref: RefObject<HTMLElement | null>, trigger: unknown) {
  const lastHeight = useRef<number | null>(null)
  const lastTrigger = useRef(trigger)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const height = element.offsetHeight
    const previous = lastHeight.current
    const changed = lastTrigger.current !== trigger

    lastHeight.current = height
    lastTrigger.current = trigger

    if (!changed || previous === null || previous === height || prefersReducedMotion()) return

    element.animate(
      [{ height: `${previous}px`, overflow: 'hidden' }, { height: `${height}px`, overflow: 'hidden' }],
      { duration: DURATION_MS, easing: EASE_OUT_EXPO }
    )
  })
}

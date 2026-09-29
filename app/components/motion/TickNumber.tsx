'use client'

import { useState } from 'react'

/**
 * Renders a number that slides in from the direction of the change whenever
 * it changes (up: from below, down: from above). The first render and
 * re-renders with the same value do not animate, so data refreshes are still.
 */
export default function TickNumber({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)

  if (value !== shown) {
    setDirection(value > shown ? 'up' : 'down')
    setShown(value)
  }

  const animation = direction === 'up' ? 'animate-tick-up' : direction === 'down' ? 'animate-tick-down' : ''

  return (
    <span key={shown} className={`inline-block ${animation} ${className}`}>
      {value}
    </span>
  )
}

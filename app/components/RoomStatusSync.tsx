'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type RoomStatus = 'waiting' | 'active' | 'finished'

export default function RoomStatusSync({
  roomId,
  initialStatus,
}: {
  roomId: string
  initialStatus: RoomStatus
}) {
  const router = useRouter()
  const pathname = usePathname()
  const statusRef = useRef<RoomStatus>(initialStatus)

  useEffect(() => {
    statusRef.current = initialStatus
  }, [initialStatus])

  useEffect(() => {
    let cancelled = false

    const syncStatus = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/status`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as { status?: RoomStatus }
        const nextStatus = data.status

        if (!nextStatus || cancelled || nextStatus === statusRef.current) {
          return
        }

        statusRef.current = nextStatus

        if (nextStatus !== 'waiting' && pathname.startsWith(`/home/${roomId}/settings`)) {
          router.replace(`/home/${roomId}`)
        }

        if (nextStatus === 'waiting' && (pathname === `/home/${roomId}` || pathname.startsWith(`/home/${roomId}/history`))) {
          router.replace(`/home/${roomId}/standings`)
        }

        if (nextStatus === 'finished' && pathname === `/home/${roomId}`) {
          router.replace(`/home/${roomId}/standings`)
        }

        router.refresh()
      } catch {
        // Ignore transient polling failures.
      }
    }

    // Every poll is a serverless invocation, so poll slowly and only while the
    // tab is visible; check immediately when the user comes back to the tab.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncStatus()
    }, 30_000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncStatus()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [pathname, roomId, router])

  return null
}
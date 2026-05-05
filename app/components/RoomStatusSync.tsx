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

    const intervalId = window.setInterval(syncStatus, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [pathname, roomId, router])

  return null
}
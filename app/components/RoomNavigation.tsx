'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function RoomNavigation({
  roomId,
  showSettings,
}: {
  roomId: string
  showSettings: boolean
}) {
  const pathname = usePathname()

  const tabs: Array<{ href: string; label: string; exact?: boolean }> = [
    { href: `/home/${roomId}`, label: 'Bets', exact: true },
    { href: `/home/${roomId}/history`, label: 'History' },
    { href: `/home/${roomId}/standings`, label: 'Standings' },
    { href: `/home/${roomId}/rules`, label: 'Rules' },
  ]

  if (showSettings) {
    tabs.push({ href: `/home/${roomId}/settings`, label: 'Settings' })
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="flex gap-0 mb-8 border-b border-border-soft">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            isActive(tab.href, tab.exact)
              ? 'border-brand text-brand'
              : 'border-transparent text-text-muted hover:text-text-main hover:border-brand-soft'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

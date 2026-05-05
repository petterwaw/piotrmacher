'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ticket, Clock, Trophy, BookOpen, Settings } from 'lucide-react'

const tabIcons: Record<string, React.ElementType> = {
  Bets: Ticket,
  History: Clock,
  Standings: Trophy,
  Rules: BookOpen,
  Settings: Settings,
}

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
    <>
      {/* Desktop sidebar nav */}
      <div className="mb-6 hidden md:block">
        <div className="flex w-full flex-col gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-2 text-left text-sm font-medium transition-colors ${
                isActive(tab.href, tab.exact)
                  ? 'bg-white text-brand'
                  : 'text-text-muted hover:bg-zinc-100 hover:text-text-main'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t-2 border-zinc-300 bg-white md:hidden">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.label]
          const active = isActive(tab.href, tab.exact)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                active ? 'text-brand' : 'text-zinc-400 hover:text-brand'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

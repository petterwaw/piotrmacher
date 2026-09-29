import Link from 'next/link'
import { Trophy } from 'lucide-react'

type RoomStatus = 'Waiting' | 'Active' | 'Finished'

export type RoomCardProps = {
    id: string
    href: string
    eventName: string
    eventLogo?: string | null
    createdBy: string
    createdAt: string
    playersCount: number
    status: RoomStatus
}

const statusStyles: Record<RoomStatus, string> = {
    Waiting: 'bg-amber-100 text-amber-900',
    Active: 'bg-green-100 text-green-900',
    Finished: 'bg-zinc-200/70 text-zinc-700',
}

function StatusChip({ status }: { status: RoomStatus }) {
    return (
        <span className={`status-chip ${statusStyles[status]}`}>
            {status === 'Active' ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-700" /> : null}
            {status}
        </span>
    )
}

function EventLogo({ src, className }: { src: string | null; className: string }) {
    if (src) {
        return <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" className={`object-contain ${className}`} />
    }

    return (
        <div aria-hidden="true" className={`flex items-center justify-center border-2 border-dashed border-zinc-200 text-zinc-300 ${className}`}>
            <Trophy size={32} strokeWidth={1.75} />
        </div>
    )
}

function PlayersCount({ count }: { count: number }) {
    return (
        <p className="whitespace-nowrap">
            <span className="font-black tabular-nums text-brand">{count}</span> {count === 1 ? 'player' : 'players'}
        </p>
    )
}

export default function RoomCard({
    href,
    eventName,
    eventLogo = null,
    createdBy,
    playersCount,
    status,
}: RoomCardProps) {
    return (
        <Link
            href={href}
            className="group flex flex-col border-2 border-zinc-300 bg-white/90 p-5 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-brand hover:shadow-lg hover:shadow-black/5 motion-safe:hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
            <div className="hidden h-full flex-col md:flex">
                <h2 className="break-words text-lg font-black uppercase leading-tight tracking-tight text-text-main">{eventName}</h2>
                <div className="mt-2">
                    <StatusChip status={status} />
                </div>

                <div className="flex flex-1 items-center justify-center py-4">
                    <EventLogo src={eventLogo} className="h-24 w-24" />
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-sm text-text-muted">
                    <p className="min-w-0 truncate">
                        <span className="font-semibold uppercase tracking-wide text-text-main">Host:</span> {createdBy}
                    </p>
                    <PlayersCount count={playersCount} />
                </div>
            </div>

            <div className="md:hidden">
                <div className="flex items-stretch justify-between gap-4">
                    <div className="min-w-0 flex-1 text-sm text-text-muted">
                        <h2 className="break-words text-lg font-black uppercase leading-tight tracking-tight text-text-main">{eventName}</h2>
                        <div className="mt-2">
                            <StatusChip status={status} />
                        </div>

                        <p className="mt-3 min-w-0 truncate">
                            <span className="font-semibold uppercase tracking-wide text-text-main">Host:</span> {createdBy}
                        </p>
                        <div className="mt-1">
                            <PlayersCount count={playersCount} />
                        </div>
                    </div>

                    <div className="flex w-24 shrink-0 items-center justify-center self-stretch">
                        <EventLogo src={eventLogo} className="h-20 w-20" />
                    </div>
                </div>
            </div>
        </Link>
    )
}

import Link from 'next/link'

type RoomStatus = 'Waiting' | 'Active' | 'Finished'

export type RoomCardProps = {
    id: string
    eventName: string
    createdBy: string
    createdAt: string
    playersCount: number
    status: RoomStatus
}

const statusStyles: Record<RoomStatus, string> = {
    Waiting: 'bg-yellow-100 text-yellow-800',
    Active: 'bg-green-100 text-green-800',
    Finished: 'bg-gray-100 text-gray-500',
}

export default function RoomCard({
    id,
    eventName,
    createdBy,
    createdAt,
    playersCount,
    status,
}: RoomCardProps) {
    return (
        <Link href={`/home/${id}`} className="block bg-bg-surface hover:bg-bg-hover border border-border-soft rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
                <h2 className="text-text-main font-semibold text-lg leading-tight">{eventName}</h2>
                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[status]}`}>
                    {status}
                </span>
            </div>
            <div className="h-px bg-border-soft" />
            <div className="flex flex-col gap-1.5 text-sm text-text-muted">
                <p>
                    <span className="font-medium text-text-main">Host:</span> {createdBy}
                </p>
                <p>
                    <span className="font-medium text-text-main">Created:</span>{' '}
                    {new Date(createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
            </div>
            <div className="mt-auto pt-1">
                <span className="text-sm text-text-muted">
                    <span className="font-semibold text-brand">{playersCount}</span> players
                </span>
            </div>
        </Link>
    )
}
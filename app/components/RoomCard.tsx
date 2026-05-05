import Link from 'next/link'

type RoomStatus = 'Waiting' | 'Active' | 'Finished'

export type RoomCardProps = {
    id: string
    eventName: string
    eventLogo?: string | null
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
    eventLogo = null,
    createdBy,
    playersCount,
    status,
}: RoomCardProps) {
    return (
        <Link href={`/home/${id}`} className="group block border-2 border-zinc-300 bg-white/90 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
            <div className="hidden md:block">
                <h2 className="text-lg font-black uppercase leading-tight tracking-tight text-text-main">{eventName}</h2>
                <span className={`mt-1 inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusStyles[status]}`}>
                    {status.toLowerCase()}
                </span>

                <div className="flex justify-center py-2">
                    {eventLogo ? (
                        <img src={eventLogo} alt="" aria-hidden="true" className="h-24 w-24 object-contain" />
                    ) : (
                        <div className="h-24 w-24" />
                    )}
                </div>

                <div className="mt-3 flex items-center justify-between text-sm text-text-muted">
                    <p>
                        <span className="font-semibold uppercase tracking-wide text-text-main">Host:</span> {createdBy}
                    </p>
                    <p>
                        <span className="font-black text-brand">{playersCount}</span> players
                    </p>
                </div>
            </div>

            <div className="md:hidden">
                <div className="flex items-stretch justify-between gap-4">
                    <div className="min-w-0 flex-1 text-sm text-text-muted">
                        <h2 className="text-lg font-black uppercase leading-tight tracking-tight text-text-main">{eventName}</h2>
                        <span className={`mt-2 inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusStyles[status]}`}>
                            {status.toLowerCase()}
                        </span>

                        <p className="mt-3 min-w-0">
                            <span className="font-semibold uppercase tracking-wide text-text-main">Host:</span> {createdBy}
                        </p>
                        <p className="mt-1">
                            <span className="font-black text-brand">{playersCount}</span> players
                        </p>
                    </div>

                    <div className="flex min-w-[96px] items-center justify-center self-stretch">
                        {eventLogo ? (
                            <img src={eventLogo} alt="" aria-hidden="true" className="h-full w-auto max-h-[112px] object-contain" />
                        ) : (
                            <div className="h-full w-[96px]" />
                        )}
                    </div>
                </div>
            </div>
        </Link>
    )
}
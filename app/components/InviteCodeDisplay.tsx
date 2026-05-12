'use client'

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function InviteCodeDisplay({ code, isHost }: { code: string | null; isHost: boolean }) {
  const [copied, setCopied] = useState(false)

  if (!isHost || !code) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-6 border-2 border-brand bg-brand/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Invite code</p>
          <p className="font-black text-brand">{code.toUpperCase()}</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 border-2 border-brand bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand transition-all hover:bg-brand hover:text-white"
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}

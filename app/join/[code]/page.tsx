import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { normalizeInviteCode } from '@/app/utils/share/invite'
import JoinFlow from './JoinFlow'

// Deliberately generic: the invite code is the secret, so the preview a chat
// app unfurls must not describe the room (name, host, members, event).
const INVITE_TITLE = "You're invited to a prediction room"
const INVITE_DESCRIPTION =
  'A friend wants you in their score-prediction room on Piotrmacher. Predict every match, settle it in the table.'

const INVITE_IMAGE_ALT = "You're invited to a prediction room on Piotrmacher"

export const metadata: Metadata = {
  title: "You're invited",
  description: INVITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'Piotrmacher',
    title: INVITE_TITLE,
    description: INVITE_DESCRIPTION,
    // Static, code-independent card (app/join/opengraph-image.tsx). Listed by
    // hand: overriding `openGraph` here drops the root layout's image.
    images: [{ url: '/join/opengraph-image', width: 1200, height: 630, alt: INVITE_IMAGE_ALT, type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: INVITE_TITLE,
    description: INVITE_DESCRIPTION,
    images: [{ url: '/join/twitter-image', width: 1200, height: 630, alt: INVITE_IMAGE_ALT }],
  },
  robots: { index: false, follow: false },
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  const code = normalizeInviteCode(rawCode)

  let signedIn = false
  if (code) {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    signedIn = Boolean(user)
  }

  return <JoinFlow code={code} signedIn={signedIn} />
}

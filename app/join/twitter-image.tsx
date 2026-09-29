import { INVITE_CARD, OG_SIZE, renderShareCard } from '../_og/brand'

// Same generic card as opengraph-image: never reads the invite code.
export const alt = "You're invited to a prediction room on Piotrmacher"
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return renderShareCard(INVITE_CARD)
}

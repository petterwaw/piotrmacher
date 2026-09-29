import { INVITE_CARD, OG_SIZE, renderShareCard } from '../_og/brand'

// One static card for every /join/<code> link: it never reads the code, so
// the preview can't reveal anything about the room.
export const alt = "You're invited to a prediction room on Piotrmacher"
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return renderShareCard(INVITE_CARD)
}

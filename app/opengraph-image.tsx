import { LANDING_CARD, OG_SIZE, renderShareCard } from './_og/brand'

export const alt = 'Piotrmacher: call the score with friends. Private score-prediction rooms.'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return renderShareCard(LANDING_CARD)
}

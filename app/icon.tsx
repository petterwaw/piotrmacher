import { renderIcon } from './_og/brand'

const SIZES = [32, 192, 512]

export function generateImageMetadata() {
  return SIZES.map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: 'image/png',
  }))
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id)
  return renderIcon(SIZES.includes(px) ? px : 32)
}

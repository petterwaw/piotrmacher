import type { MetadataRoute } from 'next'
import { SITE_URL } from './utils/share/invite'

// Only the landing page is public; everything else sits behind sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: 'monthly', priority: 1 }]
}

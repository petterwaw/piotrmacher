import type { MetadataRoute } from 'next'
import { SITE_URL } from './utils/share/invite'

const PRIVATE = ['/home', '/api/', '/profile', '/auth/']

// Chat apps fetch invite links to draw the preview card (Twitterbot, for one,
// skips cards for disallowed URLs). The /join page and its image are generic
// and carry noindex, so these fetchers may read them; search crawlers may not.
const LINK_PREVIEW_BOTS = [
  'Twitterbot',
  'facebookexternalhit',
  'Facebot',
  'WhatsApp',
  'Slackbot-LinkExpanding',
  'Discordbot',
  'TelegramBot',
  'LinkedInBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: LINK_PREVIEW_BOTS, allow: '/', disallow: PRIVATE },
      { userAgent: '*', allow: '/', disallow: [...PRIVATE, '/join'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

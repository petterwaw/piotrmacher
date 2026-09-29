import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Piotrmacher',
    short_name: 'Piotrmacher',
    description: 'Score predictions with your friends in private rooms.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#F5F6F8',
    theme_color: '#2E7D32',
    icons: [
      { src: '/icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png' },
    ],
  }
}

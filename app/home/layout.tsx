import type { Metadata } from 'next'

// Everything under /home is private (signed-in rooms): keep it out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children
}

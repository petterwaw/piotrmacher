import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Header from './components/Header'
import AppFooter from './components/AppFooter'
import { SITE_NAME, SITE_URL } from './utils/share/invite'

const DESCRIPTION =
  'Score predictions with your friends. Open a private room for a league or cup, share the invite link, call the exact score of every match and let the table settle it.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Piotrmacher: call the score with friends',
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    title: 'Piotrmacher: call the score with friends',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Piotrmacher: call the score with friends',
    description: DESCRIPTION,
  },
  appleWebApp: {
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#2E7D32',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="min-h-dvh flex flex-col">
          <Header />
          <main className="flex-1 flex pt-0">{children}</main>
          <AppFooter />
        </div>
        <Analytics />
      </body>
    </html>
  )
}

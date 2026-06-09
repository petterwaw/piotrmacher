import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Header from './components/Header'
import AppFooter from './components/AppFooter'

export const metadata: Metadata = {
  title: 'PIOTRMACHER',
  description: 'Football betting room app',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
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

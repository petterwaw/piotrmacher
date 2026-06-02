import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Header from './components/Header'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
          <footer className="border-t border-zinc-300 bg-transparent pb-16 md:pb-0">
            <div className="mx-auto w-full max-w-[1320px] px-4 py-4 text-sm text-text-muted md:px-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="font-semibold text-text-main">Piotrmacher</p>
                <p>
                  Found a bug? Send details to{' '}
                  <a className="font-semibold text-brand hover:text-brand-hover" href="mailto:piotrmachersupport@gmail.com">
                    piotrmachersupport@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  )
}

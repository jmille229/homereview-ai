import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export const metadata: Metadata = {
  title: 'HomeReview AI — Independent Home Repair Analysis',
  description:
    'Get an objective, AI-powered analysis of your home repair issue or contractor quote — no referral fees, no bias.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'HomeReview AI',
    description: 'Know what you\'re paying for.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading a request header opts every route into dynamic rendering, which is
  // REQUIRED for the per-request CSP nonce set in middleware to be stamped onto
  // framework scripts. A statically prerendered page cannot carry a per-request
  // nonce, so its inline scripts would be blocked by the nonce-based policy.
  // Trade-off: pages are server-rendered per request rather than served as
  // static HTML (acceptable for this app's scale; revisit if traffic grows).
  headers()

  return (
    <html lang="en">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}

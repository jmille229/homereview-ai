import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { JsonLd } from '@/components/seo/JsonLd'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'
import { organizationJsonLd, websiteJsonLd } from '@/lib/structuredData'

export const metadata: Metadata = {
  title: 'HomeReview AI — Independent Home Repair Analysis',
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: SITE_NAME,
    description: 'Know what you\'re paying for.',
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
  },
  // The image itself comes from app/opengraph-image.tsx (file convention).
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <ErrorBoundary>{children}</ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}

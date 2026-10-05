import { OG_SIZE, renderOgImage } from '@/lib/og'
import { LANDING_PAGES, getLandingPage } from '@/lib/landing'

export const alt = 'HomeReview AI quote check'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return LANDING_PAGES.map(({ slug }) => ({ slug }))
}

export default function Image({ params }: { params: { slug: string } }) {
  const page = getLandingPage(params.slug)
  return renderOgImage({
    eyebrow:  page?.eyebrow ?? 'Quote check',
    title:    page?.h1 ?? 'Is my quote fair?',
    subtitle: 'Typical prices, red flags, and the questions to ask before you sign.',
  })
}

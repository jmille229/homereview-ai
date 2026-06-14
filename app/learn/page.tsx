import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { isArticleLive } from '@/lib/articles'

export const metadata = {
  title: 'Learn — HomeReview AI',
  description: 'Guides and resources for homeowners navigating repairs and contractor quotes.',
}

// ─── Content structure ────────────────────────────────────────────────────────
//
// Articles are defined statically here for v1.
// Each article links to /learn/[slug] — individual article pages to be built
// as the content library grows. Slugs are placeholders until articles are written.

interface Article {
  slug:      string
  category:  string
  title:     string
  summary:   string
  readTime:  string
  published: string
  featured?: boolean
}

const ARTICLES: Article[] = [
  {
    slug:      'hvac-replacement-quote-fair-price',
    category:  'HVAC',
    title:     'Is your HVAC replacement quote fair? What to expect in 2026.',
    summary:   'A complete breakdown of what a furnace or AC replacement should cost, what drives variation, and the line items most likely to be padded.',
    readTime:  '6 min',
    published: 'May 2026',
    featured:  true,
  },
  {
    slug:      'galvanized-pipe-repipe-cost',
    category:  'Plumbing',
    title:     'Galvanized pipes and repiping: what homeowners in older homes need to know.',
    summary:   'Houses built before 1970 likely have galvanized steel pipes. Here\'s how to know if they\'re failing, what replacement costs, and what a complete scope includes.',
    readTime:  '7 min',
    published: 'May 2026',
    featured:  true,
  },
  {
    slug:      'roofing-quote-red-flags',
    category:  'Roofing',
    title:     'Six red flags in a roofing quote — and what to do about them.',
    summary:   'Roofing is one of the most common categories for contractor fraud. These are the specific language patterns, scope gaps, and pricing signals that should give you pause.',
    readTime:  '5 min',
    published: 'May 2026',
    featured:  true,
  },
  {
    slug:      'foundation-crack-diagnosis',
    category:  'Foundation',
    title:     'Not all foundation cracks are equal. Here\'s how to tell the difference.',
    summary:   'Horizontal cracks, diagonal cracks, stair-step cracks — each tells a different story about what\'s happening structurally. A guide to what warrants urgent attention vs. monitoring.',
    readTime:  '8 min',
    published: 'May 2026',
  },
  {
    slug:      'contractor-questions-before-hiring',
    category:  'Hiring',
    title:     'Eight questions to ask every contractor before signing anything.',
    summary:   'Most homeowners skip the questions that matter most. These eight — tailored to what actually separates good contractors from bad ones — should be asked before any work begins.',
    readTime:  '5 min',
    published: 'May 2026',
  },
  {
    slug:      'hvac-frozen-coil-causes',
    category:  'HVAC',
    title:     'Ice on your AC lines: what it means and what to do first.',
    summary:   'Frost on the copper lines outside your air conditioner is a symptom, not a diagnosis. Here are the three most common root causes and how to distinguish them before calling anyone.',
    readTime:  '4 min',
    published: 'May 2026',
  },
  {
    slug:      'drain-cleaning-upsells',
    category:  'Plumbing',
    title:     'The most common plumbing upsells — and when they\'re legitimate.',
    summary:   'Camera inspections, hydro-jetting, pipe descaling — these services exist for good reasons. Here\'s when they\'re warranted and when they\'re being sold to you without diagnostic basis.',
    readTime:  '5 min',
    published: 'May 2026',
  },
  {
    slug:      'reading-a-contractor-quote',
    category:  'Hiring',
    title:     'How to read a contractor estimate: what every line item means.',
    summary:   'Contractor quotes are written for contractors, not homeowners. A plain-language guide to what each section means, what should always be included, and what should make you ask questions.',
    readTime:  '6 min',
    published: 'May 2026',
  },
]

// ─── Article card ─────────────────────────────────────────────────────────────

/**
 * Live articles (content in lib/articles.ts) link to /learn/[slug]; the rest
 * are honest "Coming soon" cards until their content is written.
 */
function ArticleCard({ article }: { article: Article }) {
  const live = isArticleLive(article.slug)

  const inner = (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[11px] font-semibold text-brand-amber-deep">{article.category}</span>
        {live ? (
          <span className="text-[11px] text-brand-muted">{article.readTime} read</span>
        ) : (
          <span className="text-[11px] font-medium px-2 py-0.5 bg-brand-bg text-brand-muted rounded flex-shrink-0">
            Coming soon
          </span>
        )}
      </div>
      <h2 className={`text-sm font-semibold text-brand-navy leading-snug mb-2 ${live ? 'group-hover:underline underline-offset-2' : ''}`}>
        {article.title}
      </h2>
      <p className="text-xs text-brand-muted leading-relaxed mb-4">
        {article.summary}
      </p>
      {live
        ? <p className="text-[11px] font-semibold text-brand-amber-deep">Read guide →</p>
        : <p className="text-[11px] text-brand-muted">{article.readTime} read</p>}
    </>
  )

  return live ? (
    <Link href={`/learn/${article.slug}`} className="card block group hover:border-brand-border-dark transition-colors">
      {inner}
    </Link>
  ) : (
    <article className="card">{inner}</article>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const featured    = ARTICLES.filter(a => a.featured)
  const nonFeatured = ARTICLES.filter(a => !a.featured)

  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-2xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-xs font-semibold text-brand-amber-deep tracking-[0.08em]">
              LEARN
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-brand-navy leading-tight mb-4">
            Know before you call.
          </h1>
          <p className="text-base text-brand-muted leading-relaxed">
            Guides for homeowners navigating repairs and contractor quotes —
            written to close the knowledge gap, not fill your inbox.
          </p>
        </div>

        {/* Featured articles */}
        {featured.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-4">
              Featured
            </p>
            <div className="space-y-3">
              {featured.map(article => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        )}

        {/* All other articles */}
        {nonFeatured.length > 0 && (
          <div className="mb-10">
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-4">
              All guides
            </p>
            <div className="space-y-3">
              {nonFeatured.map(article => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-brand-border pt-8 text-center">
          <p className="text-sm text-brand-muted mb-4">
            Ready to get a specific analysis of your situation?
          </p>
          <Link href="/" className="btn-primary inline-block">
            Get your free preview →
          </Link>
        </div>

        {/* Footer nav */}
        <div className="flex gap-5 justify-center mt-10 pt-8 border-t border-brand-border">
          {[
            { href: '/',        label: 'Home' },
            { href: '/about',   label: 'About' },
            { href: '/privacy', label: 'Privacy' },
            { href: '/terms',   label: 'Terms' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-xs text-brand-muted hover:text-brand-navy transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}

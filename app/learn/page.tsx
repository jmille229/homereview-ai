import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { getPublishedArticles, type LearnListItem } from '@/lib/learn'

export const metadata = {
  title: 'Learn — HomeReview AI',
  description: 'Guides and resources for homeowners navigating repairs and contractor quotes.',
}

// ISR — new/edited Sanity articles appear without a redeploy.
export const revalidate = 60

// ─── Page chrome ──────────────────────────────────────────────────────────────

function LearnShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-xs font-semibold text-brand-amber-deep tracking-[0.08em]">LEARN</span>
          </div>
          <h1 className="text-3xl font-semibold text-brand-navy leading-tight mb-4">Know before you call.</h1>
          <p className="text-base text-brand-muted leading-relaxed">
            Guides for homeowners navigating repairs and contractor quotes —
            written to close the knowledge gap, not fill your inbox.
          </p>
        </div>

        {children}

        <div className="border-t border-brand-border pt-8 text-center mt-10">
          <p className="text-sm text-brand-muted mb-4">Ready to get a specific analysis of your situation?</p>
          <Link href="/" className="btn-primary inline-block">Get your free preview →</Link>
        </div>

        <div className="flex gap-5 justify-center mt-10 pt-8 border-t border-brand-border">
          {[
            { href: '/',        label: 'Home' },
            { href: '/about',   label: 'About' },
            { href: '/privacy', label: 'Privacy' },
            { href: '/terms',   label: 'Terms' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="text-xs text-brand-muted hover:text-brand-navy transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

function ArticleCard({ article }: { article: LearnListItem }) {
  return (
    <Link href={`/learn/${article.slug}`} className="card block group hover:border-brand-border-dark transition-colors">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[11px] font-semibold text-brand-amber-deep">{article.category}</span>
        <span className="text-[11px] text-brand-muted">{article.readTime && `${article.readTime} read`}</span>
      </div>
      <h2 className="text-sm font-semibold text-brand-navy leading-snug mb-2 group-hover:underline underline-offset-2">
        {article.title}
      </h2>
      <p className="text-xs text-brand-muted leading-relaxed mb-4">{article.summary}</p>
      <p className="text-[11px] font-semibold text-brand-amber-deep">Read guide →</p>
    </Link>
  )
}

function Section({ label, items }: { label: string; items: LearnListItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-4">{label}</p>
      <div className="space-y-3">
        {items.map((a) => <ArticleCard key={a.slug} article={a} />)}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LearnPage() {
  const articles = await getPublishedArticles()

  if (articles.length === 0) {
    return (
      <LearnShell>
        <div className="card text-center py-10">
          <p className="text-sm font-semibold text-brand-navy mb-1">New guides are on the way</p>
          <p className="text-xs text-brand-muted leading-relaxed max-w-sm mx-auto">
            We&apos;re writing practical guides for homeowners. In the meantime, you can get a
            specific analysis of your own situation below.
          </p>
        </div>
      </LearnShell>
    )
  }

  const featured = articles.filter((a) => a.featured)
  const rest = articles.filter((a) => !a.featured)
  return (
    <LearnShell>
      <Section label="Featured" items={featured} />
      <Section label={featured.length ? 'All guides' : 'Guides'} items={rest} />
    </LearnShell>
  )
}

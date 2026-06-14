import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { NavBar } from '@/components/ui/NavBar'
import { ARTICLES, getArticle } from '@/lib/articles'

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  return Object.keys(ARTICLES).map((slug) => ({ slug }))
}

export function generateMetadata({ params }: Props): Metadata {
  const article = getArticle(params.slug)
  if (!article) return { title: 'Article — HomeReview AI' }
  return { title: `${article.title} — HomeReview AI`, description: article.summary }
}

export default function ArticlePage({ params }: Props) {
  const article = getArticle(params.slug)
  if (!article) notFound()

  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <article className="max-w-2xl mx-auto px-5 py-8">
        <Link href="/learn" className="text-xs font-semibold text-brand-amber-deep hover:text-brand-navy">
          ← All guides
        </Link>

        <div className="mt-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold text-brand-amber-deep">{article.category}</span>
            <span className="text-[11px] text-brand-muted">· {article.readTime} read · {article.published}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-navy leading-tight">{article.title}</h1>
        </div>

        <div className="space-y-7">
          {article.sections.map((section, i) => (
            <section key={i}>
              {section.heading && (
                <h2 className="text-base font-semibold text-brand-navy mb-3">{section.heading}</h2>
              )}
              {section.body.map((p, j) => (
                <p key={j} className="text-sm text-brand-muted leading-relaxed mb-3">{p}</p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 mt-1">
                  {section.bullets.map((b, k) => (
                    <li key={k} className="flex gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-amber flex-shrink-0 mt-[7px]" aria-hidden="true" />
                      <span className="text-sm text-brand-muted leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 bg-white border border-brand-border rounded-2xl text-center">
          <p className="text-base font-semibold text-brand-navy mb-1.5">Got a quote of your own?</p>
          <p className="text-sm text-brand-muted mb-5 leading-relaxed">
            Quote Shield reviews your actual contractor quote line by line — pricing, scope, and red flags.
          </p>
          <Link href="/intake" className="btn-primary inline-block">Start your free preview →</Link>
        </div>

        <p className="text-[11px] text-brand-muted leading-relaxed mt-8">
          This guide is general information, not professional advice. Always consult a licensed
          professional before undertaking repairs.
        </p>
      </article>
    </main>
  )
}

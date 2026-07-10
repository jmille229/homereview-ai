import Link from 'next/link'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { NavBar } from '@/components/ui/NavBar'
import { LearnBody } from '@/components/learn/LearnBody'
import { getArticleBySlug, getAllArticleSlugs } from '@/lib/learn'
import { urlForImage } from '@/sanity/lib/image'

interface Props {
  params: { slug: string }
}

// ISR: re-render at most every 60s so published Sanity edits appear without a
// deploy (the revalidate webhook makes it near-instant). dynamicParams allows
// articles added after the last build to render on first request.
export const revalidate = 60
export const dynamicParams = true

// Dedupe the fetch shared by generateMetadata + the page within one request.
const loadArticle = cache((slug: string) => getArticleBySlug(slug))

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await loadArticle(params.slug)
  if (!article) return { title: 'Article — HomeReview AI' }
  return {
    title:       `${article.seoTitle ?? article.title} — HomeReview AI`,
    description: article.seoDescription ?? article.summary,
  }
}

export default async function ArticlePage({ params }: Props) {
  const article = await loadArticle(params.slug)
  if (!article) notFound()

  const cover = article.coverImage
    ? urlForImage(article.coverImage).width(1600).fit('max').auto('format').url()
    : null

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
            <span className="text-[11px] text-brand-muted">
              {article.readTime && `· ${article.readTime} read `}
              {article.published && `· ${article.published}`}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-navy leading-tight">{article.title}</h1>
        </div>

        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="w-full rounded-2xl border border-brand-border mb-8" />
        )}

        <LearnBody value={article.body} />

        {/* Standing CTA (articles can also embed their own inline CTA blocks) */}
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

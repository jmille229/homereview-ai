import Link from 'next/link'
import { PortableText, type PortableTextComponents } from '@portabletext/react'
import { urlForImage } from '@/sanity/lib/image'
import type { LearnBody as LearnBodyType } from '@/lib/learn'
import type { ArticleSection } from '@/lib/articles'

// ─── Callout styling by tone ──────────────────────────────────────────────────

const CALLOUT_TONES: Record<string, { wrap: string; label: string; badge: string }> = {
  tip:     { wrap: 'bg-emerald-50 border-emerald-200', label: 'Tip',      badge: 'text-emerald-700' },
  redflag: { wrap: 'bg-red-50 border-red-200',         label: 'Red flag', badge: 'text-red-700' },
  warning: { wrap: 'bg-amber-50 border-amber-200',     label: 'Warning',  badge: 'text-brand-amber-deep' },
  info:    { wrap: 'bg-brand-bg border-brand-border',  label: 'Note',     badge: 'text-brand-navy' },
}

// ─── Shared inline styling for text/marks/lists ───────────────────────────────

function LinkMark({ value, children }: { value?: { href?: string }; children: React.ReactNode }) {
  const href = value?.href ?? '#'
  const internal = href.startsWith('/')
  const className = 'text-brand-amber-deep underline underline-offset-2 hover:text-brand-navy'
  return internal
    ? <Link href={href} className={className}>{children}</Link>
    : <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
}

// ─── Portable Text serializers (brand-matched) ────────────────────────────────

const components: PortableTextComponents = {
  block: {
    normal:     ({ children }) => <p className="text-sm text-brand-muted leading-relaxed mb-4">{children}</p>,
    h2:         ({ children }) => <h2 className="text-lg font-semibold text-brand-navy mt-9 mb-3">{children}</h2>,
    h3:         ({ children }) => <h3 className="text-base font-semibold text-brand-navy mt-6 mb-2">{children}</h3>,
    blockquote: ({ children }) => <blockquote className="border-l-[3px] border-brand-amber pl-4 my-5 text-sm text-brand-navy italic leading-relaxed">{children}</blockquote>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-brand-navy">{children}</strong>,
    em:     ({ children }) => <em className="italic">{children}</em>,
    link:   LinkMark,
  },
  list: {
    bullet: ({ children }) => <ul className="space-y-2 mb-4 mt-1">{children}</ul>,
    number: ({ children }) => <ol className="space-y-2 mb-4 mt-1 list-decimal pl-5 marker:text-brand-muted">{children}</ol>,
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-amber flex-shrink-0 mt-[7px]" aria-hidden="true" />
        <span className="text-sm text-brand-muted leading-relaxed">{children}</span>
      </li>
    ),
    number: ({ children }) => <li className="text-sm text-brand-muted leading-relaxed pl-1">{children}</li>,
  },
  types: {
    callout: ({ value }) => {
      const tone = CALLOUT_TONES[value?.tone as string] ?? CALLOUT_TONES.info
      return (
        <div className={`my-6 p-4 border rounded-xl ${tone.wrap}`} role="note">
          <p className={`text-[11px] font-bold uppercase tracking-[0.06em] mb-2 ${tone.badge}`}>
            {value?.title || tone.label}
          </p>
          <div className="[&>p:last-child]:mb-0 [&>ul:last-child]:mb-0">
            <PortableText value={value?.body ?? []} components={components} />
          </div>
        </div>
      )
    },
    captionedImage: ({ value }) => {
      if (!value?.asset) return null
      const src = urlForImage(value).width(1400).fit('max').auto('format').url()
      return (
        <figure className="my-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={value.alt ?? ''} className="w-full rounded-xl border border-brand-border" loading="lazy" />
          {value.caption && (
            <figcaption className="text-xs text-brand-muted mt-2 text-center">{value.caption}</figcaption>
          )}
        </figure>
      )
    },
    comparisonTable: ({ value }) => {
      const columns: string[] = value?.columns ?? []
      const rows: Array<{ cells?: string[] }> = value?.rows ?? []
      return (
        <figure className="my-7">
          <div className="overflow-x-auto border border-brand-border rounded-xl">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-brand-bg">
                  {columns.map((c, i) => (
                    <th key={i} className="text-left font-semibold text-brand-navy px-4 py-2.5 border-b border-brand-border whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-brand-border last:border-0">
                    {(row.cells ?? []).map((cell, ci) => (
                      <td key={ci} className={`px-4 py-2.5 align-top leading-relaxed ${ci === 0 ? 'font-medium text-brand-navy' : 'text-brand-muted'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {value?.caption && <figcaption className="text-xs text-brand-muted mt-2">{value.caption}</figcaption>}
        </figure>
      )
    },
    ctaBlock: ({ value }) => {
      const href = value?.href ?? '/intake'
      const internal = href.startsWith('/')
      return (
        <div className="my-8 p-6 bg-white border border-brand-border rounded-2xl text-center">
          <p className="text-base font-semibold text-brand-navy mb-1.5">{value?.heading}</p>
          {value?.body && <p className="text-sm text-brand-muted mb-5 leading-relaxed">{value.body}</p>}
          {internal
            ? <Link href={href} className="btn-primary inline-block">{value?.buttonLabel}</Link>
            : <a href={href} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block">{value?.buttonLabel}</a>}
        </div>
      )
    },
    pullQuote: ({ value }) => (
      <blockquote className="my-8 text-center">
        <p className="text-lg font-semibold text-brand-navy leading-snug">“{value?.quote}”</p>
        {value?.attribution && <cite className="block text-xs text-brand-muted mt-2 not-italic">— {value.attribution}</cite>}
      </blockquote>
    ),
  },
}

// ─── Legacy renderer (static lib/articles content, pre-migration) ─────────────

function LegacySections({ sections }: { sections: ArticleSection[] }) {
  return (
    <div className="space-y-7">
      {sections.map((section, i) => (
        <section key={i}>
          {section.heading && <h2 className="text-base font-semibold text-brand-navy mb-3">{section.heading}</h2>}
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
  )
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function LearnBody({ body }: { body: LearnBodyType }) {
  if (body.kind === 'legacy') return <LegacySections sections={body.sections} />
  return <PortableText value={body.value} components={components} />
}

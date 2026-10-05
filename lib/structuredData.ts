import { SITE_NAME, SITE_DESCRIPTION, SITE_URL, absoluteUrl } from './site'
import { PRODUCT_PRICING } from './pricing'
import type { Product } from './enums'

/**
 * lib/structuredData.ts — schema.org JSON-LD builders. Pure functions (no React)
 * so they're easy to unit test and reuse across pages.
 */

type Json = Record<string, unknown>

const ORG_ID = `${SITE_URL}/#organization`

export function organizationJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    '@id':      ORG_ID,
    name:        SITE_NAME,
    url:         SITE_URL,
    description: SITE_DESCRIPTION,
  }
}

export function websiteJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type':    'WebSite',
    '@id':      `${SITE_URL}/#website`,
    name:       SITE_NAME,
    url:        SITE_URL,
    publisher:  { '@id': ORG_ID },
  }
}

const PRODUCT_DESCRIPTIONS: Record<Product, string> = {
  brief:  'A plain-language diagnosis of a home problem before you call a contractor: likely cause, severity, fair cost range, and the questions to ask.',
  shield: 'A line-by-line review of a contractor quote: pricing against typical ranges, missing scope, upsell flags, and negotiation language.',
}

/** A paid report as a schema.org Service with its price. */
export function serviceJsonLd(product: Product, opts: { url: string; areaServed?: string } ): Json {
  const p = PRODUCT_PRICING[product]
  return {
    '@context':  'https://schema.org',
    '@type':     'Service',
    name:        `${SITE_NAME} ${p.name}`,
    serviceType: 'Home repair and contractor quote analysis',
    description: PRODUCT_DESCRIPTIONS[product],
    provider:    { '@id': ORG_ID },
    areaServed:  { '@type': 'Country', name: opts.areaServed ?? 'United States' },
    url:         opts.url,
    offers: {
      '@type':        'Offer',
      price:          (p.amountCents / 100).toFixed(2),
      priceCurrency:  'USD',
      availability:   'https://schema.org/InStock',
      url:            opts.url,
    },
  }
}

export function faqJsonLd(faqs: { q: string; a: string }[]): Json {
  return {
    '@context':  'https://schema.org',
    '@type':     'FAQPage',
    mainEntity:  faqs.map(({ q, a }) => ({
      '@type':          'Question',
      name:             q,
      acceptedAnswer:   { '@type': 'Answer', text: a },
    })),
  }
}

/** Breadcrumb trail; each crumb is [name, site path]. */
export function breadcrumbJsonLd(crumbs: [string, string][]): Json {
  return {
    '@context':       'https://schema.org',
    '@type':          'BreadcrumbList',
    itemListElement:  crumbs.map(([name, path], i) => ({
      '@type':   'ListItem',
      position:  i + 1,
      name,
      item:      absoluteUrl(path),
    })),
  }
}

export function articleJsonLd(a: {
  title:        string
  description:  string
  path:         string
  image?:       string | null
  publishedAt?: string
}): Json {
  return {
    '@context':        'https://schema.org',
    '@type':           'Article',
    headline:          a.title,
    description:       a.description,
    mainEntityOfPage:  absoluteUrl(a.path),
    ...(a.image ? { image: [a.image] } : {}),
    ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
    author:            { '@id': ORG_ID },
    publisher:         { '@id': ORG_ID },
  }
}

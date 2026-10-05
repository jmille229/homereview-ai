import { describe, it, expect } from 'vitest'
import { LANDING_PAGES, getLandingPage } from '@/lib/landing'
import { CATEGORY_LABELS } from '@/lib/constants'
import { faqJsonLd, serviceJsonLd, breadcrumbJsonLd } from '@/lib/structuredData'

describe('landing pages', () => {
  it('have unique, URL-safe slugs', () => {
    const slugs = LANDING_PAGES.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('use known categories and valid dates', () => {
    for (const p of LANDING_PAGES) {
      expect(CATEGORY_LABELS[p.category]).toBeTruthy()
      expect(Number.isNaN(Date.parse(p.updated))).toBe(false)
    }
  })

  it('keep titles and descriptions within search snippet limits', () => {
    for (const p of LANDING_PAGES) {
      expect(`${p.metaTitle} | HomeReview AI`.length).toBeLessThanOrEqual(75)
      expect(p.metaDescription.length).toBeGreaterThanOrEqual(110)
      expect(p.metaDescription.length).toBeLessThanOrEqual(165)
    }
  })

  it('fill every template section', () => {
    for (const p of LANDING_PAGES) {
      expect(p.costTable.rows.length).toBeGreaterThan(0)
      expect(p.priceDrivers.length).toBeGreaterThan(0)
      expect(p.redFlags.length).toBeGreaterThan(0)
      expect(p.questions.length).toBeGreaterThan(0)
      expect(p.faqs.length).toBeGreaterThan(0)
    }
  })

  it('looks up by slug', () => {
    expect(getLandingPage('is-my-hvac-quote-fair')?.category).toBe('hvac')
    expect(getLandingPage('nope')).toBeUndefined()
  })
})

describe('structured data', () => {
  it('builds a FAQPage', () => {
    const ld = faqJsonLd([{ q: 'Q?', a: 'A.' }])
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity).toEqual([
      { '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } },
    ])
  })

  it('prices the Service offer from lib/pricing', () => {
    const ld = serviceJsonLd('shield', { url: 'https://example.com/x' }) as { offers: { price: string; priceCurrency: string } }
    expect(ld.offers.price).toBe('29.00')
    expect(ld.offers.priceCurrency).toBe('USD')
  })

  it('numbers breadcrumbs from 1 with absolute URLs', () => {
    const ld = breadcrumbJsonLd([['Home', '/'], ['Learn', '/learn']]) as { itemListElement: { position: number; item: string }[] }
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2])
    expect(ld.itemListElement[1].item).toMatch(/^https?:\/\/.+\/learn$/)
  })
})

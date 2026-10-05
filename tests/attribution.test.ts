import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import {
  attributionFromStripeMetadata,
  attributionToStripeMetadata,
  buildFbc,
  parseAttributionParams,
  sanitizeAttribution,
  MAX_ATTRIBUTION_VALUE,
} from '@/lib/attribution'
import { buildMetaPurchaseEvent } from '@/lib/conversions'

describe('parseAttributionParams', () => {
  it('captures UTM params and click IDs', () => {
    expect(
      parseAttributionParams('?utm_source=facebook&utm_medium=paid&utm_campaign=hvac&fbclid=abc&gclid=xyz&other=1'),
    ).toEqual({ utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'hvac', fbclid: 'abc', gclid: 'xyz' })
  })

  it('returns null when the URL has no campaign params (so a direct visit never overwrites a touch)', () => {
    expect(parseAttributionParams('')).toBeNull()
    expect(parseAttributionParams('?stripe_session_id=cs_test_1&utm_source=')).toBeNull()
  })
})

describe('sanitizeAttribution', () => {
  it('drops unknown keys, non-strings, and control characters, and caps length', () => {
    const out = sanitizeAttribution({
      utm_source: 'goo\u0000gle\n',
      utm_term:   'x'.repeat(1000),
      evil:       'drop me',
      gclid:      42,
    })
    expect(out).toEqual({ utm_source: 'google', utm_term: 'x'.repeat(MAX_ATTRIBUTION_VALUE) })
  })

  it('handles junk input', () => {
    expect(sanitizeAttribution(null)).toEqual({})
    expect(sanitizeAttribution('nope')).toEqual({})
  })
})

describe('Stripe metadata round trip', () => {
  it('prefixes keys and reads them back, ignoring non-attribution metadata', () => {
    const md = attributionToStripeMetadata({ utm_source: 'google', gclid: 'g1', fbp: 'fb.1.1.2' })
    expect(md).toEqual({ attr_utm_source: 'google', attr_gclid: 'g1', attr_fbp: 'fb.1.1.2' })
    for (const [k, v] of Object.entries(md)) {
      expect(k.length).toBeLessThanOrEqual(40)
      expect(v.length).toBeLessThanOrEqual(500)
    }
    expect(
      attributionFromStripeMetadata({ ...md, reportSessionId: 'abc', product: 'brief', attr_bogus: 'x' }),
    ).toEqual({ utm_source: 'google', gclid: 'g1', fbp: 'fb.1.1.2' })
  })
})

describe('buildFbc', () => {
  it('uses Meta’s fbc format', () => {
    expect(buildFbc('IwAR123', 1700000000000)).toBe('fb.1.1700000000000.IwAR123')
  })
})

describe('buildMetaPurchaseEvent', () => {
  it('builds a de-duplicable Purchase event with hashed email and charged value', () => {
    const checkout = {
      id:           'cs_test_abc',
      currency:     'usd',
      amount_total: 1400,
      customer_details: { email: ' Buyer@Example.com ' },
      metadata: {
        product:  'brief',
        capi_ip:  '203.0.113.7',
        capi_ua:  'Mozilla/5.0',
        attr_fbp: 'fb.1.1.2',
        attr_fbc: 'fb.1.1700000000000.IwAR123',
      },
    } as unknown as Stripe.Checkout.Session

    const event = buildMetaPurchaseEvent(checkout, 'https://gethomereview.com')
    expect(event.event_name).toBe('Purchase')
    expect(event.event_id).toBe('cs_test_abc') // matches the browser pixel's eventID
    expect(event.action_source).toBe('website')
    expect(event.custom_data).toMatchObject({ currency: 'USD', value: 14, content_ids: ['brief'] })
    expect(event.user_data).toEqual({
      // sha256 of the trimmed, lowercased email
      em: ['6a6c26195c3682faa816966af789717c3bfa834eee6c599d667d2b3429c27cfd'],
      client_ip_address: '203.0.113.7',
      client_user_agent: 'Mozilla/5.0',
      fbp: 'fb.1.1.2',
      fbc: 'fb.1.1700000000000.IwAR123',
    })
  })
})

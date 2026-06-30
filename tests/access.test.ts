import { describe, it, expect, vi } from 'vitest'

// hasValidAccess() reads request cookies; stub next/headers so importing the
// module never touches a request context. We only test the pure token logic.
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))

import {
  createAccessToken,
  verifyAccessToken,
  createShareToken,
  verifyShareToken,
  accessWindowSeconds,
} from '@/lib/access'

const SID = '11111111-1111-4111-8111-111111111111'

describe('access tokens', () => {
  it('round-trips a freshly minted token', () => {
    const token = createAccessToken(SID, 3600)
    expect(verifyAccessToken(SID, token)).toBe(true)
  })

  it('rejects a token bound to a different session (no IDOR via token reuse)', () => {
    const token = createAccessToken(SID, 3600)
    const otherSid = '22222222-2222-4222-8222-222222222222'
    expect(verifyAccessToken(otherSid, token)).toBe(false)
  })

  it('rejects an expired token', () => {
    const expired = createAccessToken(SID, -10) // exp in the past
    expect(verifyAccessToken(SID, expired)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const token = createAccessToken(SID, 3600)
    const [v, e, sig] = token.split('.')
    const flipped = sig[0] === 'a' ? 'b' : 'a'
    const tampered = `${v}.${e}.${flipped}${sig.slice(1)}`
    expect(verifyAccessToken(SID, tampered)).toBe(false)
  })

  it('rejects malformed tokens and empty input', () => {
    expect(verifyAccessToken(SID, undefined)).toBe(false)
    expect(verifyAccessToken(SID, '')).toBe(false)
    expect(verifyAccessToken(SID, 'not.a.token.at.all')).toBe(false)
    expect(verifyAccessToken(SID, 'v1.abc.def')).toBe(false) // non-integer exp
  })

  it('does not let a share token act as an access token (and vice versa)', () => {
    const share = createShareToken(SID)
    expect(verifyShareToken(SID, share)).toBe(true)
    expect(verifyAccessToken(SID, share)).toBe(false)

    const access = createAccessToken(SID, 3600)
    expect(verifyShareToken(SID, access)).toBe(false)
  })

  it('maps products to their access windows', () => {
    expect(accessWindowSeconds('brief')).toBe(30 * 24 * 60 * 60)
    expect(accessWindowSeconds('shield')).toBe(60 * 24 * 60 * 60)
  })
})

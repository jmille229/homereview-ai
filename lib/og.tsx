import { ImageResponse } from 'next/og'

/**
 * lib/og.tsx — shared renderer for social share (Open Graph / Twitter) cards.
 * Colors mirror tailwind.config.ts brand tokens; ImageResponse can't read
 * Tailwind classes, so they're inlined here.
 */

export const OG_SIZE = { width: 1200, height: 630 }

const NAVY  = '#1C2B3A'
const AMBER = '#B8722E'
const BG    = '#F5F0E8'
const MUTED = '#5A6678'

export function renderOgImage({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: BG, padding: '72px 80px',
          borderTop: `14px solid ${AMBER}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: AMBER }} />
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4, color: AMBER }}>HOMEREVIEW</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: AMBER, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20 }}>
            {eyebrow}
          </div>
          <div style={{ fontSize: 68, fontWeight: 800, color: NAVY, lineHeight: 1.08, letterSpacing: -1 }}>{title}</div>
          <div style={{ fontSize: 30, color: MUTED, marginTop: 26, lineHeight: 1.35 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>
          No referral fees · No kickbacks · Free preview
        </div>
      </div>
    ),
    OG_SIZE,
  )
}

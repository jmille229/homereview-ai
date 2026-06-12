'use client'

import Link from 'next/link'
import { useState } from 'react'

interface NavBarProps {
  /**
   * site — marketing pages (home, learn, about, terms): full nav links + CTA.
   * flow — funnel pages: deliberately minimal (back + step) to protect conversion.
   */
  variant?: 'site' | 'flow'
  step?:    string
  onBack?:  () => void
  /** site variant only — homepage passes a handler that resets the session store. */
  onStart?: () => void
}

function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
      aria-label="HomeReview — back to home"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-brand-amber" aria-hidden="true" />
      <span className="text-xs font-semibold text-brand-amber-deep tracking-[0.08em]">
        HOMEREVIEW
      </span>
    </Link>
  )
}

const SITE_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#products',     label: 'Reports' },
  { href: '/learn',         label: 'Learn' },
  { href: '/about',         label: 'About' },
  { href: '/recover',       label: 'My report' },
]

const START_CLASSES =
  'text-xs font-semibold px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-opacity-90 transition-colors whitespace-nowrap'

/**
 * Marketing header. Desktop shows inline nav links; mobile collapses them into
 * an accessible toggle menu so the links aren't stranded on small screens.
 */
function SiteHeader({ onStart }: { onStart?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 bg-brand-bg border-b border-brand-border print:hidden">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
        <Wordmark />

        <nav className="hidden sm:flex items-center gap-6" aria-label="Site navigation">
          {SITE_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="text-xs text-brand-muted hover:text-brand-navy transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {onStart ? (
            <button onClick={onStart} className={START_CLASSES}>Start free →</button>
          ) : (
            <Link href="/intake" className={START_CLASSES}>Start free →</Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="sm:hidden p-2 -mr-1.5 text-brand-navy"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-site-nav"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-site-nav" className="sm:hidden border-t border-brand-border px-5 py-1" aria-label="Site navigation">
          {SITE_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm font-medium text-brand-navy hover:text-brand-amber-deep transition-colors border-b border-brand-border last:border-0"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}

export function NavBar({ variant = 'flow', step, onBack, onStart }: NavBarProps) {
  if (variant === 'site') {
    return <SiteHeader onStart={onStart} />
  }

  return (
    <header className="sticky top-0 z-10 bg-brand-bg border-b border-brand-border print:hidden">
      <div className="max-w-xl mx-auto px-5 h-12 flex items-center">

        {/* Back button */}
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-navy transition-colors mr-4"
            aria-label="Go back"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        ) : null}

        <Wordmark />

        {/* Step indicator */}
        {step && (
          <span className="ml-auto text-xs font-medium text-brand-muted" aria-label={step}>
            {step}
          </span>
        )}

      </div>
    </header>
  )
}

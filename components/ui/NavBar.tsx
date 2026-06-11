'use client'

import Link from 'next/link'

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
]

export function NavBar({ variant = 'flow', step, onBack, onStart }: NavBarProps) {
  if (variant === 'site') {
    return (
      <header className="sticky top-0 z-20 bg-brand-bg border-b border-brand-border print:hidden">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden sm:flex items-center gap-6" aria-label="Site navigation">
            {SITE_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="text-xs text-brand-muted hover:text-brand-navy transition-colors">
                {label}
              </Link>
            ))}
          </nav>
          {onStart ? (
            <button
              onClick={onStart}
              className="text-xs font-semibold px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Start free →
            </button>
          ) : (
            <Link
              href="/intake"
              className="text-xs font-semibold px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Start free →
            </Link>
          )}
        </div>
      </header>
    )
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

'use client'

import Link from 'next/link'

interface NavBarProps {
  step?:   string
  onBack?: () => void
}

/**
 * Sticky top navigation for all flow pages.
 * The wordmark always links home. Back button is shown when onBack is provided.
 * Step indicator appears at the right when in a multi-step flow.
 */
export function NavBar({ step, onBack }: NavBarProps) {
  return (
    <header className="sticky top-0 z-10 bg-brand-bg border-b border-brand-border">
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

        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          aria-label="HomeReview — back to home"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-brand-amber" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-brand-amber tracking-[0.08em]">
            HOMEREVIEW
          </span>
        </Link>

        {/* Step indicator */}
        {step && (
          <span className="ml-auto text-[11px] font-medium text-brand-muted" aria-label={step}>
            {step}
          </span>
        )}

      </div>
    </header>
  )
}

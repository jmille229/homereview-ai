'use client'

interface NavBarProps {
  step?: string
  onBack?: () => void
}

export function NavBar({ step, onBack }: NavBarProps) {
  return (
    <div className="flex items-center mb-7 pb-4 border-b border-brand-border">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
        <span className="text-xs font-semibold text-brand-amber tracking-[0.08em]">
          HOMEREVIEW
        </span>
      </div>

      {onBack && (
        <button
          onClick={onBack}
          className="ml-4 text-xs text-brand-muted hover:text-brand-navy transition-colors"
          aria-label="Go back"
        >
          ← Back
        </button>
      )}

      {step && (
        <span className="ml-auto text-xs text-brand-muted" aria-label={step}>
          {step}
        </span>
      )}
    </div>
  )
}

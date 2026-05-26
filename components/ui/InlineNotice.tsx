/**
 * Inline notice component for field-level hints, warnings, and errors.
 *
 * variant='hint'    — muted, shown proactively to guide input
 * variant='error'   — red, shown after validation failure
 * variant='warning' — amber, shown for soft warnings (e.g. optional field value quality)
 */

interface InlineNoticeProps {
  message:   string
  variant:   'hint' | 'error' | 'warning'
  className?: string
}

const STYLES = {
  hint:    'text-brand-muted',
  error:   'text-red-600',
  warning: 'text-amber-700',
}

export function InlineNotice({ message, variant, className = '' }: InlineNoticeProps) {
  return (
    <p
      role={variant === 'error' ? 'alert' : undefined}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`text-xs mt-1.5 leading-relaxed ${STYLES[variant]} ${className}`}
    >
      {message}
    </p>
  )
}

'use client'

import { LoadingSpinner } from './LoadingSpinner'

/**
 * Single source of truth for button styling.
 *
 * Variants:
 *   primary   — navy fill; the one true call-to-action treatment
 *   secondary — white card with border; the "other path" next to a primary
 *   ghost     — borderless-feeling utility action (cancel, dismiss)
 *
 * The amber brand color is deliberately NOT a button variant — amber is an
 * accent, not an interactive affordance. Keeping one primary color teaches
 * users a single, reliable "this is the main action" signal.
 */

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:      Variant
  size?:         Size
  full?:         boolean
  loading?:      boolean
  loadingLabel?: string
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-brand-navy text-white hover:bg-opacity-90 active:bg-opacity-80',
  secondary:
    'bg-white border border-brand-border text-brand-navy hover:border-brand-border-dark',
  ghost:
    'bg-transparent border border-brand-border text-brand-muted hover:border-brand-border-dark hover:text-brand-navy',
}

const SIZE_CLASSES: Record<Size, string> = {
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3.5 text-sm',
}

const SPINNER_COLOR: Record<Variant, string> = {
  primary:   'white',
  secondary: '#1C2B3A',
  ghost:     '#5A6678',
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  loadingLabel,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        full ? 'w-full' : '',
        'inline-flex items-center justify-center gap-2 font-semibold rounded-xl',
        'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <LoadingSpinner size={15} color={SPINNER_COLOR[variant]} />
          <span>{loadingLabel ?? 'Working…'}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

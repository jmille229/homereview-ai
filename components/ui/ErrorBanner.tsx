/**
 * Full-width error banner for page-level failures.
 * Used when an API call fails, a network error occurs,
 * or something breaks that prevents the user from continuing.
 *
 * Distinct from InlineNotice (field-level) — this sits at the top
 * of the form and communicates a blocking error clearly.
 */

interface ErrorBannerProps {
  title?:   string
  message:  string
  onRetry?: () => void
}

export function ErrorBanner({ title, message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl"
    >
      {title && (
        <p className="text-sm font-semibold text-red-800 mb-1">{title}</p>
      )}
      <p className="text-xs text-red-700 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  )
}

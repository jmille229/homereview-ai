import type { Severity } from '@/lib/types'

interface SeverityBadgeProps {
  severity: Severity
  className?: string
}

const SEVERITY_CONFIG: Record<
  Severity,
  { bg: string; text: string; dot: string; label: string }
> = {
  Cosmetic: {
    bg:    'bg-emerald-50',
    text:  'text-emerald-800',
    dot:   'bg-emerald-500',
    label: 'Cosmetic — schedule when convenient',
  },
  Monitor: {
    bg:    'bg-amber-50',
    text:  'text-amber-800',
    dot:   'bg-amber-400',
    label: 'Monitor — watch for changes',
  },
  Urgent: {
    bg:    'bg-red-50',
    text:  'text-red-800',
    dot:   'bg-red-500',
    label: 'Urgent — act within 1–2 weeks',
  },
  Emergency: {
    bg:    'bg-rose-100',
    text:  'text-rose-900',
    dot:   'bg-rose-600',
    label: 'Emergency — act within 24 hours',
  },
}

export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const cfg = SEVERITY_CONFIG[severity]

  if (!cfg) {
    // Guard against unexpected values from AI — fail gracefully
    return null
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${cfg.bg} ${className}`}
      role="status"
      aria-label={cfg.label}
    >
      <span
        className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`}
        aria-hidden="true"
      />
      <span className={`text-[13px] font-semibold ${cfg.text}`}>{severity}</span>
    </span>
  )
}

interface ProgressBarProps {
  step:  number  // 1-based current step
  total: number  // total steps
}

/**
 * Slim proportional progress bar shown at the top of each flow step.
 * Deliberately minimal — communicates progress without adding cognitive load.
 */
export function ProgressBar({ step, total }: ProgressBarProps) {
  const pct = Math.round((step / total) * 100)

  return (
    <div className="w-full h-0.5 bg-brand-border rounded-full overflow-hidden mb-6">
      <div
        className="h-full bg-brand-amber rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}`}
      />
    </div>
  )
}

import { AlertTriangleIcon, CheckIcon } from '@/components/ui/icons'

/**
 * Decorative hero visual: a contractor quote being "scanned," with red / amber /
 * green findings + dollar amounts + a question emerging — a literal picture of
 * what Quote Shield produces. Purely visual (aria-hidden); animation respects
 * prefers-reduced-motion via globals.css.
 */
function LineItem({ w, price, flagged }: { w: string; price: string; flagged?: 'red' | 'amber' }) {
  const tint = flagged === 'red' ? 'bg-red-50' : flagged === 'amber' ? 'bg-amber-50' : ''
  return (
    <div className={`flex items-center justify-between gap-3 rounded px-2 py-1.5 ${tint}`}>
      <div className="h-2 rounded-full bg-brand-border" style={{ width: w }} />
      <div className="h-2 w-10 rounded-full bg-brand-border/80 flex-shrink-0" />
      <span className="sr-only">{price}</span>
    </div>
  )
}

export function QuoteScanVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
      {/* Quote document */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-semibold tracking-[0.12em] text-brand-muted">CONTRACTOR QUOTE</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">HVAC</span>
        </div>

        <div className="space-y-2">
          <LineItem w="58%" price="$2,400" />
          <LineItem w="44%" price="$450" flagged="red" />
          <LineItem w="64%" price="$1,800" />
          <LineItem w="38%" price="$0" flagged="amber" />
          <LineItem w="50%" price="$900" />
        </div>

        <div className="mt-4 pt-3 border-t border-brand-border flex items-center justify-between">
          <span className="text-[10px] font-semibold text-brand-muted">TOTAL</span>
          <span className="text-sm font-bold text-brand-navy tabular-nums">$8,900</span>
        </div>

        {/* Scan beam */}
        <div className="hr-beam pointer-events-none absolute left-0 right-0 h-8 bg-gradient-to-b from-transparent via-brand-amber/20 to-transparent" />
      </div>

      {/* Findings */}
      <div
        className="hr-chip absolute -right-3 top-10 flex items-center gap-1.5 rounded-lg bg-white border border-red-200 shadow-sm px-2.5 py-1.5"
        style={{ animationDelay: '0.5s' }}
      >
        <AlertTriangleIcon size={13} className="text-red-600" />
        <span className="text-[11px] font-semibold text-red-700">Padded · +$450</span>
      </div>

      <div
        className="hr-chip absolute -left-3 top-1/2 flex items-center gap-1.5 rounded-lg bg-white border border-emerald-200 shadow-sm px-2.5 py-1.5"
        style={{ animationDelay: '1s' }}
      >
        <CheckIcon size={13} className="text-emerald-600" />
        <span className="text-[11px] font-semibold text-emerald-700">Fair labor rate</span>
      </div>

      <div
        className="hr-chip absolute -right-2 top-[58%] rounded-lg bg-white border border-amber-200 shadow-sm px-2.5 py-1.5"
        style={{ animationDelay: '1.5s' }}
      >
        <span className="text-[11px] font-semibold text-amber-700">Missing: permit</span>
      </div>

      <div
        className="hr-chip absolute -bottom-4 left-6 rounded-lg bg-brand-navy shadow-md px-3 py-2"
        style={{ animationDelay: '2s' }}
      >
        <p className="text-[10px] font-semibold text-white opacity-60 uppercase tracking-wider leading-none mb-1">Fair range</p>
        <p className="text-sm font-bold text-white tabular-nums leading-none">$6,200–$7,600</p>
      </div>

      <div
        className="hr-chip absolute -bottom-3 -right-2 rounded-lg bg-white border border-brand-border shadow-sm px-2.5 py-1.5 max-w-[150px]"
        style={{ animationDelay: '2.5s' }}
      >
        <span className="text-[11px] font-medium text-brand-navy">Ask: was it pressure-tested?</span>
      </div>
    </div>
  )
}

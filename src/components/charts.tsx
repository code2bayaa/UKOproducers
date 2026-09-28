/**
 * One-series bar chart of earnings per day / month. Single series → no legend (the panel title names it); thin bars
 * with a 2px gap and a 4px rounded top anchored to the baseline; a per-bar hover tooltip; the table under it is the
 * accessible view of the same numbers.
 */
import { useState } from 'react'
import type { PeriodRow } from '#/lib/api'
import { kes, num } from '#/lib/format'

export function EarningsBars({ rows, metric = 'producer_ksh', label }: { rows: PeriodRow[]; metric?: 'producer_ksh' | 'views'; label: (p: string) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (!rows.length) return <p className="m-0 py-10 text-center text-[13px] text-muted">No views in this period yet.</p>
  const max = Math.max(...rows.map((r) => r[metric]), metric === 'views' ? 1 : 0.01)
  const h = hover === null ? null : rows[hover]
  return (
    <div className="relative">
      <div className="flex h-44 items-end gap-[2px] border-b border-border" role="img"
        aria-label={`${metric === 'views' ? 'Views' : 'Your share'} per period, highest ${metric === 'views' ? num(max) : kes(max)}`}>
        {rows.map((r, i) => (
          <div key={r.period} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className={`w-full rounded-t-[4px] ${hover === i ? 'bg-secondary' : 'bg-primary'}`}
              style={{ height: `${Math.max(r[metric] > 0 ? 2 : 0, (r[metric] / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{label(rows[0].period)}</span>
        <span>{label(rows[rows.length - 1].period)}</span>
      </div>
      {h && (
        <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-md border border-border bg-bg px-3 py-2 text-xs shadow-card">
          <div className="font-semibold text-ink">{label(h.period)}</div>
          <div className="text-ink-2">{num(h.views)} views · {num(h.paid_views)} paid</div>
          <div className="text-ink">Your share <b>{kes(h.producer_ksh)}</b></div>
        </div>
      )}
    </div>
  )
}

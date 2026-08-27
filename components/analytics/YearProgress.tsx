import { formatRubRounded } from './constants'
import type { YearTotal } from '@/lib/project-finance'

function yearColorClass(year: number, pct: number, currentYear: number) {
  if (year > currentYear) return 'bg-line'
  if (year === currentYear) return 'bg-urgent'
  return pct >= 90 ? 'bg-teal' : 'bg-normal'
}

export default function YearProgress({ yearTotals }: { yearTotals: YearTotal[] }) {
  const currentYear = new Date().getFullYear()

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Освоение по годам (портфель)</h2>
      {yearTotals.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Пока нет данных плана — заполни план субсидии на «Глоссарии».</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {yearTotals.map((y) => (
            <div key={y.year}>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm font-medium text-ink">{y.year}</span>
                {y.plan > 0 && <span className="font-mono text-xs text-ink-soft">{y.pct.toFixed(1)}%</span>}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${yearColorClass(y.year, y.pct, currentYear)}`}
                  style={{ width: `${y.plan > 0 ? Math.max(0, Math.min(100, y.pct)) : 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {y.plan > 0 ? `${formatRubRounded(y.released)} из ${formatRubRounded(y.plan)}` : `${formatRubRounded(y.released)} доведено — план не задан`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { formatRubRounded } from './constants'
import type { DirectionFinance } from '@/lib/project-finance'

export default function DirectionRemainders({
  byDirection,
  onSelectDirection,
}: {
  byDirection: DirectionFinance[]
  onSelectDirection: (direction: string) => void
}) {
  const currentYear = new Date().getFullYear()

  // Остаток за текущий год — прошлые годы уже закрыты, будущие обычно ещё без плана,
  // сумма по всем годам разом была бы не показательна (см. план).
  const rankedRemainder = byDirection
    .map((d) => ({ direction: d.direction, remainder: d.years.find((y) => y.year === currentYear)?.remainder ?? 0 }))
    // > 1 ₽, не > 0 — копеечные расхождения из-за округления при ручном вводе плана.
    .filter((d) => d.remainder > 1)
    .sort((a, b) => b.remainder - a.remainder)
  const maxRemainder = rankedRemainder[0]?.remainder ?? 0

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Остаток к доведению по направлениям ({currentYear})</h2>
      <p className="mt-0.5 text-sm text-ink-soft">План минус факт за {currentYear} год — клик по строке фильтрует таблицу проектов.</p>
      {rankedRemainder.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Остатков за {currentYear} год нет — доведено по плану (или план ещё не задан).</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {rankedRemainder.map((d) => (
            <button
              key={d.direction}
              onClick={() => onSelectDirection(d.direction)}
              className="block w-full text-left transition hover:opacity-80"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink">{d.direction}</span>
                <span className="font-mono text-xs font-medium text-ink">{formatRubRounded(d.remainder)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-urgent"
                  style={{ width: `${maxRemainder > 0 ? (d.remainder / maxRemainder) * 100 : 0}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

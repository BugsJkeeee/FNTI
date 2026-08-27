'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatRub } from './constants'
import type { DirectionFinance, ProjectShare } from '@/lib/project-finance'

function pctColorClass(pct: number) {
  if (pct >= 90) return 'bg-teal'
  if (pct >= 70) return 'bg-normal'
  return 'bg-urgent'
}

export default function DirectionYearTable({ byDirection, allYears }: { byDirection: DirectionFinance[]; allYears: number[] }) {
  const [drilldown, setDrilldown] = useState<{ title: string; rows: ProjectShare[] } | null>(null)

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">По направлениям</h2>
      <p className="mt-0.5 text-sm text-ink-soft">Клик по проценту — список проектов направления за этот год.</p>
      {byDirection.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Нет данных.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="pb-1 pr-6 font-medium">Направление</th>
                {allYears.map((year) => (
                  <th key={year} className="pb-1 pr-6 font-medium">{year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byDirection.map((d) => {
                const byYear = new Map(d.years.map((y) => [y.year, y]))
                return (
                  <tr key={d.direction} className="border-t border-line">
                    <td className="py-2 pr-6 text-ink">{d.direction}</td>
                    {allYears.map((year) => {
                      const y = byYear.get(year)
                      if (!y) {
                        return (
                          <td key={year} className="py-2 pr-6 text-ink-soft">
                            —
                          </td>
                        )
                      }
                      return (
                        <td key={year} className="py-2 pr-6">
                          <button
                            onClick={() => setDrilldown({ title: `${d.direction} · ${year}`, rows: y.byProject })}
                            title={y.plan > 0 ? `${formatRub(y.released)} из ${formatRub(y.plan)}` : `${formatRub(y.released)} доведено, план не задан`}
                            className="flex items-center gap-2 text-left transition hover:opacity-80"
                          >
                            {y.plan > 0 ? (
                              <>
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                                  <div className={`h-full rounded-full ${pctColorClass(y.pct)}`} style={{ width: `${Math.max(0, Math.min(100, y.pct))}%` }} />
                                </div>
                                <span className="font-mono text-ink">{y.pct.toFixed(0)}%</span>
                              </>
                            ) : (
                              <span className="font-mono text-ink-soft">{formatRub(y.released)}</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {drilldown && (
        <div className="mt-4 rounded-xl border border-line bg-paper p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">{drilldown.title}</h3>
            <button onClick={() => setDrilldown(null)} className="text-xs text-ink-soft hover:text-ink">
              Закрыть ✕
            </button>
          </div>
          <div className="mt-2 divide-y divide-line">
            {drilldown.rows.length === 0 ? (
              <p className="py-2 text-sm text-ink-soft">Нет данных.</p>
            ) : (
              drilldown.rows.map((r) => (
                <Link key={r.projectId} href={`/projects/${r.projectId}`} className="flex items-center justify-between gap-3 py-2 text-sm transition hover:text-teal">
                  <span className="text-ink">{r.code || `№${r.number}`}</span>
                  <span className="font-mono text-xs text-ink-soft">план {formatRub(r.obligation)} · факт {formatRub(r.released)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

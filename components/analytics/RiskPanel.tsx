'use client'

import { Fragment, forwardRef, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatRubRounded } from './constants'
import type { PortfolioRisk, ProjectForAnalytics, StageRisk } from '@/lib/project-risk'

type RiskRow = {
  projectId: string
  code: string
  number: number
  stage: StageRisk
}

function buildRiskRows(projects: ProjectForAnalytics[], risk: PortfolioRisk): RiskRow[] {
  const rows: RiskRow[] = []
  projects.forEach((p) => {
    const pr = risk.byProject.get(p.id)
    if (!pr) return
    pr.stageRisks
      .filter((s) => s.level !== 'none')
      .forEach((s) => rows.push({ projectId: p.id, code: p.code, number: p.number, stage: s }))
  })
  return rows.sort((a, b) => b.stage.amount - a.stage.amount)
}

function RiskDot({ level }: { level: 'none' | 'medium' | 'high' }) {
  const cls = level === 'high' ? 'bg-urgent' : level === 'medium' ? 'bg-normal' : 'bg-line'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />
}

function RiskList({ rows }: { rows: RiskRow[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-ink-soft">Рисковых этапов нет.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ink-soft">
            <th className="pb-1.5 pr-4 font-medium" />
            <th className="pb-1.5 pr-4 font-medium">Проект</th>
            <th className="pb-1.5 pr-4 font-medium">Причина</th>
            <th className="pb-1.5 pr-4 font-medium">Под риском</th>
            <th className="pb-1.5 font-medium">Дней до дедлайна</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.projectId}-${r.stage.stageId}-${i}`} className="border-t border-line">
              <td className="py-2 pr-4">
                <RiskDot level={r.stage.level} />
              </td>
              <td className="py-2 pr-4">
                <Link href={`/projects/${r.projectId}`} className="text-ink transition hover:text-teal">
                  {r.code || `№${r.number}`}
                </Link>
                <span className="ml-1 text-ink-soft">· этап {r.stage.stageNumber}</span>
              </td>
              <td className="py-2 pr-4 text-ink-soft">{r.stage.reasons[0] ?? '—'}</td>
              <td className="py-2 pr-4 font-mono text-ink">{formatRubRounded(r.stage.amount)}</td>
              <td className={`py-2 font-mono ${r.stage.daysToDeadline !== null && r.stage.daysToDeadline < 0 ? 'font-medium text-urgent' : 'text-ink-soft'}`}>
                {r.stage.daysToDeadline ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Вероятность — не из спеки (там абстрактная эвристика), а из того, что реально различает
// наши данные: неисполненное требование о возврате — почти гарантированный возврат денег
// (факт из протокола), просрочка по расписанию — предположение подороже, но не факт.
function probabilityBucket(stage: StageRisk): 'low' | 'medium' | 'high' {
  if (stage.reasons.some((r) => r.includes('требование о возврате'))) return 'high'
  if (stage.level === 'high') return 'medium'
  return 'low'
}

const PROB_LABELS: Record<'low' | 'medium' | 'high', string> = { low: 'Низкая', medium: 'Средняя', high: 'Высокая' }
const AMOUNT_LABELS: Record<'low' | 'medium' | 'high', string> = { low: 'Небольшая', medium: 'Средняя', high: 'Крупная' }

function RiskMatrix({ rows }: { rows: RiskRow[] }) {
  const maxAmount = Math.max(1, ...rows.map((r) => r.stage.amount))

  function amountBucket(amount: number): 'low' | 'medium' | 'high' {
    if (amount < maxAmount / 3) return 'low'
    if (amount < (maxAmount * 2) / 3) return 'medium'
    return 'high'
  }

  const grid = useMemo(() => {
    const cells = new Map<string, { count: number; amount: number }>()
    rows.forEach((r) => {
      const key = `${probabilityBucket(r.stage)}-${amountBucket(r.stage.amount)}`
      const cur = cells.get(key) ?? { count: 0, amount: 0 }
      cur.count += 1
      cur.amount += r.stage.amount
      cells.set(key, cur)
    })
    return cells
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, maxAmount])

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-ink-soft">Рисковых этапов нет.</p>

  const amountLevels: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low']
  const probLevels: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high']

  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">Строки — сумма под риском, столбцы — вероятность возврата.</p>
      <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1.5">
        <div />
        {probLevels.map((p) => (
          <div key={p} className="text-center text-[11px] font-medium text-ink-soft">{PROB_LABELS[p]}</div>
        ))}
        {amountLevels.map((a) => (
          <Fragment key={a}>
            <div className="flex items-center text-[11px] font-medium text-ink-soft">{AMOUNT_LABELS[a]}</div>
            {probLevels.map((p) => {
              const cell = grid.get(`${p}-${a}`)
              const intensity = cell ? Math.min(1, 0.25 + cell.count / Math.max(1, rows.length)) : 0
              return (
                <div
                  key={`${a}-${p}`}
                  className="flex aspect-square flex-col items-center justify-center rounded-lg border border-line text-center"
                  style={cell ? { backgroundColor: `rgba(196, 71, 43, ${intensity})` } : undefined}
                >
                  {cell ? (
                    <>
                      <span className={`font-display text-sm font-semibold ${intensity > 0.5 ? 'text-white' : 'text-ink'}`}>{cell.count}</span>
                      <span className={`text-[10px] ${intensity > 0.5 ? 'text-white/90' : 'text-ink-soft'}`}>{formatRubRounded(cell.amount)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-soft">—</span>
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

const RiskPanel = forwardRef<HTMLDivElement, { projects: ProjectForAnalytics[]; risk: PortfolioRisk }>(function RiskPanel(
  { projects, risk },
  ref
) {
  const [tab, setTab] = useState<'list' | 'matrix'>('list')
  const rows = buildRiskRows(projects, risk)

  return (
    <div ref={ref} className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Риски возврата</h2>
      <div className="mt-2 flex gap-1 border-b border-line">
        <button
          onClick={() => setTab('list')}
          className={`px-3 py-1.5 text-sm transition ${tab === 'list' ? 'border-b-2 border-teal font-medium text-teal' : 'text-ink-soft hover:text-ink'}`}
        >
          Список
        </button>
        <button
          onClick={() => setTab('matrix')}
          className={`px-3 py-1.5 text-sm transition ${tab === 'matrix' ? 'border-b-2 border-teal font-medium text-teal' : 'text-ink-soft hover:text-ink'}`}
        >
          Матрица
        </button>
      </div>
      <div className="mt-3">{tab === 'list' ? <RiskList rows={rows} /> : <RiskMatrix rows={rows} />}</div>
    </div>
  )
})

export default RiskPanel

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { aggregatePortfolioFinance } from '@/lib/project-finance'
import type { DirectionSubsidyPlan } from '@/types'
import type { ClaimRow, PaymentWithProject, ProjectForFinance, ProjectShare } from '@/lib/project-finance'

function formatRub(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽'
}

// Для крупных сводных цифр (KPI-плашки) копейки не нужны — округляем, чтобы число не
// переносилось на вторую строку в узкой плашке. Точные суммы с копейками остаются в
// детальных строках таблиц и в drill-down.
function formatRubRounded(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'
}

function pctColorClass(pct: number) {
  if (pct >= 80) return 'bg-teal'
  if (pct >= 40) return 'bg-normal'
  return 'bg-urgent'
}

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-line ${className ?? 'w-full'}`}>
      <div className={`h-full rounded-full ${pctColorClass(clamped)}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  items.forEach((item) => {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  })
  return map
}

const STATUS_LABELS: Record<ProjectForFinance['status'], string> = {
  active: 'действующий',
  terminating: 'прекращаем',
  terminated: 'прекращён',
}
const STATUS_ORDER: ProjectForFinance['status'][] = ['active', 'terminating', 'terminated']

type FilterOption = { key: string; label: string; count: number; ids: string[] }

function CategoryDropdown({
  label,
  options,
  isGroupSelected,
  toggleGroup,
}: {
  label: string
  options: FilterOption[]
  isGroupSelected: (ids: string[]) => boolean
  toggleGroup: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedCount = options.filter((o) => isGroupSelected(o.ids)).length
  const allSelected = selectedCount === options.length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full border px-3 py-1.5 text-xs transition ${
          allSelected ? 'border-line text-ink-soft hover:border-teal' : 'border-teal bg-teal-soft text-teal'
        }`}
      >
        {label}: {allSelected ? 'все' : `${selectedCount} из ${options.length}`} ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-line bg-white p-1.5 shadow-lg">
            {options.map((opt) => (
              <label
                key={opt.key}
                title={opt.label}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-paper"
              >
                <input type="checkbox" checked={isGroupSelected(opt.ids)} onChange={() => toggleGroup(opt.ids)} />
                <span className="min-w-0 flex-1 truncate text-ink">{opt.label}</span>
                <span className="shrink-0 font-mono text-xs text-ink-soft">{opt.count}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProjectFilterPanel({
  projects,
  selectedIds,
  onChange,
}: {
  projects: ProjectForFinance[]
  selectedIds: Set<string>
  onChange: (ids: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const byWave = useMemo(() => groupBy(projects, (p) => String(p.wave)), [projects])
  const byStatus = useMemo(() => groupBy(projects, (p) => p.status), [projects])
  const byDirection = useMemo(() => groupBy(projects, (p) => p.tech_direction), [projects])

  const waveKeys = [...byWave.keys()].sort((a, b) => Number(a) - Number(b))
  const statusKeys = STATUS_ORDER.filter((s) => byStatus.has(s))
  const directionKeys = [...byDirection.keys()].sort((a, b) => a.localeCompare(b, 'ru'))

  function isGroupSelected(ids: string[]) {
    return ids.length > 0 && ids.every((id) => selectedIds.has(id))
  }

  function toggleGroup(ids: string[]) {
    const allSelected = isGroupSelected(ids)
    const next = new Set(selectedIds)
    ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
    onChange(next)
  }

  function toggleProject(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const allSelected = selectedIds.size === projects.length
  const filtered = search.trim()
    ? projects.filter((p) => (p.code || `№${p.number}`).toLowerCase().includes(search.trim().toLowerCase()))
    : projects

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Фильтр проектов</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {allSelected ? 'Учитываются все проекты портфеля.' : `Учитывается ${selectedIds.size} из ${projects.length}.`}
          </p>
        </div>
        <span className="text-xs text-ink-soft">{open ? 'Свернуть' : 'Настроить'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск проекта по шифру…"
              className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-teal sm:w-56"
            />
            <CategoryDropdown
              label="Волна"
              options={waveKeys.map((wave) => ({ key: wave, label: `${wave} волна`, count: byWave.get(wave)!.length, ids: byWave.get(wave)!.map((p) => p.id) }))}
              isGroupSelected={isGroupSelected}
              toggleGroup={toggleGroup}
            />
            <CategoryDropdown
              label="Статус"
              options={statusKeys.map((status) => ({
                key: status,
                label: STATUS_LABELS[status],
                count: byStatus.get(status)!.length,
                ids: byStatus.get(status)!.map((p) => p.id),
              }))}
              isGroupSelected={isGroupSelected}
              toggleGroup={toggleGroup}
            />
            <CategoryDropdown
              label="Направление"
              options={directionKeys.map((direction) => ({
                key: direction,
                label: direction,
                count: byDirection.get(direction)!.length,
                ids: byDirection.get(direction)!.map((p) => p.id),
              }))}
              isGroupSelected={isGroupSelected}
              toggleGroup={toggleGroup}
            />
            {!allSelected && (
              <button type="button" onClick={() => onChange(new Set(projects.map((p) => p.id)))} className="text-xs text-teal hover:opacity-80">
                выбрать все
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-ink-soft">Ничего не найдено.</p>}
            {filtered.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-sm last:border-0 hover:bg-paper"
              >
                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleProject(p.id)} />
                <span className="text-ink">{p.code || `№${p.number}`}</span>
                <span className="font-mono text-xs text-ink-soft">
                  · {p.wave} волна{p.status !== 'active' && ` · ${STATUS_LABELS[p.status]}`}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type Drilldown = { title: string; rows: ProjectShare[] } | { title: string; claims: ClaimRow[] }

function DrilldownPanel({ drilldown, onClose }: { drilldown: Drilldown; onClose: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">{drilldown.title}</h3>
        <button onClick={onClose} className="text-xs text-ink-soft hover:text-ink">
          Закрыть ✕
        </button>
      </div>
      <div className="mt-2 divide-y divide-line">
        {'rows' in drilldown &&
          (drilldown.rows.length === 0 ? (
            <p className="py-2 text-sm text-ink-soft">Нет данных.</p>
          ) : (
            drilldown.rows.map((r) => (
              <Link
                key={r.projectId}
                href={`/projects/${r.projectId}`}
                className="flex items-center justify-between gap-3 py-2 text-sm transition hover:text-teal"
              >
                <span className="text-ink">{r.code || `№${r.number}`}</span>
                <span className="font-mono text-xs text-ink-soft">
                  план {formatRub(r.obligation)} · факт {formatRub(r.released)}
                </span>
              </Link>
            ))
          ))}
        {'claims' in drilldown &&
          (drilldown.claims.length === 0 ? (
            <p className="py-2 text-sm text-ink-soft">Нет требований.</p>
          ) : (
            drilldown.claims.map((c, i) => (
              <Link
                key={i}
                href={`/projects/${c.projectId}`}
                className="flex items-center justify-between gap-3 py-2 text-sm transition hover:text-teal"
              >
                <span className="text-ink">
                  {c.code || `№${c.number}`} {c.claimNumber && `· ${c.claimNumber}`}
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-ink-soft">
                  {formatRub(c.balance ?? 0)}
                  <span className={c.resolved ? 'text-done' : 'text-urgent'}>{c.resolved ? 'исполнено' : 'не исполнено'}</span>
                </span>
              </Link>
            ))
          ))}
      </div>
    </div>
  )
}

export default function ProjectFinanceDashboard({
  projects,
  payments,
  directionPlans,
}: {
  projects: ProjectForFinance[]
  payments: PaymentWithProject[]
  directionPlans: DirectionSubsidyPlan[]
}) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set(projects.map((p) => p.id)))
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null)

  const summary = useMemo(
    () => aggregatePortfolioFinance(projects, payments, directionPlans, { includedProjectIds: selectedProjectIds }),
    [projects, payments, directionPlans, selectedProjectIds]
  )

  const waveEntries = Object.entries(summary.kpis.byWave).sort((a, b) => Number(a[0]) - Number(b[0]))

  const rankedRemainder = useMemo(
    // > 1 ₽, не > 0 — копеечные расхождения из-за округления при ручном вводе плана не должны
    // попадать в список "остатков" как будто это реальный недобор.
    () => [...summary.byDirection].filter((d) => d.totalRemainder > 1).sort((a, b) => b.totalRemainder - a.totalRemainder),
    [summary]
  )
  const maxRemainder = rankedRemainder[0]?.totalRemainder ?? 0

  return (
    <div className="mt-4 space-y-4">
      <ProjectFilterPanel projects={projects} selectedIds={selectedProjectIds} onChange={setSelectedProjectIds} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white p-2.5 text-center">
          <p className="font-display text-sm font-semibold text-ink">{summary.kpis.totalProjects}</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">проектов в портфеле</p>
        </div>
        {waveEntries.map(([wave, count]) => (
          <div key={wave} className="flex flex-col items-center justify-center rounded-xl border border-line bg-white p-2.5 text-center">
            <p className="font-display text-sm font-semibold text-ink">{count}</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">{wave} волна</p>
          </div>
        ))}
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white p-2.5 text-center">
          <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(summary.kpis.totalBudget)}</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">договорной бюджет портфеля</p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-base font-semibold text-ink">Освоение по годам (портфель)</h2>
        {summary.yearTotals.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Пока нет данных плана — заполни план субсидии на «Глоссарии».</p>
        ) : (
          <div className="mt-3 space-y-3">
            {summary.yearTotals.map((y) => (
              <div key={y.year}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-ink">{y.year}</span>
                  <span className="font-mono text-xs text-ink-soft">
                    {y.plan > 0
                      ? `${formatRubRounded(y.released)} из ${formatRubRounded(y.plan)} (${y.pct.toFixed(1)}%)`
                      : `${formatRubRounded(y.released)} доведено — план не задан`}
                  </span>
                </div>
                {y.plan > 0 && (
                  <div className="mt-1">
                    <ProgressBar pct={y.pct} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-base font-semibold text-ink">Остаток к доведению по направлениям</h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          План минус факт за годы, где план задан — самые крупные остатки сверху.
        </p>
        {rankedRemainder.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Остатков нет — везде доведено по плану (или план ещё не задан).</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {rankedRemainder.map((d) => (
              <div key={d.direction}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink">{d.direction}</span>
                  <span className="font-mono text-xs text-ink-soft">{formatRubRounded(d.totalRemainder)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-urgent"
                    style={{ width: `${maxRemainder > 0 ? (d.totalRemainder / maxRemainder) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-base font-semibold text-ink">По направлениям</h2>
        <p className="mt-0.5 text-sm text-ink-soft">Клик по проценту — список проектов направления за этот год.</p>
        {summary.byDirection.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Нет данных.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="pb-1 pr-6 font-medium">Направление</th>
                  {summary.allYears.map((year) => (
                    <th key={year} className="pb-1 pr-6 font-medium">{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.byDirection.map((d) => {
                  const byYear = new Map(d.years.map((y) => [y.year, y]))
                  return (
                    <tr key={d.direction} className="border-t border-line">
                      <td className="py-2 pr-6 text-ink">{d.direction}</td>
                      {summary.allYears.map((year) => {
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
                              title={
                                y.plan > 0
                                  ? `${formatRub(y.released)} из ${formatRub(y.plan)}`
                                  : `${formatRub(y.released)} доведено, план не задан`
                              }
                              className="flex items-center gap-2 text-left transition hover:opacity-80"
                            >
                              {y.plan > 0 ? (
                                <>
                                  <ProgressBar pct={y.pct} className="w-16" />
                                  <span className="font-mono text-ink">{y.pct.toFixed(0)}%</span>
                                </>
                              ) : (
                                <span className="font-mono text-ink-soft">{formatRubRounded(y.released)}</span>
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
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-base font-semibold text-ink">Возвраты</h2>
        {summary.claims.totalClaims === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Требований о возврате нет.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <button
                onClick={() => setDrilldown({ title: 'Требования о возврате', claims: summary.claims.claims })}
                className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center transition hover:border-teal"
              >
                <p className="font-display text-sm font-semibold text-ink">{summary.claims.totalClaims}</p>
                <p className="mt-0.5 text-xs text-ink-soft">всего требований</p>
              </button>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
                <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(summary.claims.sumBalance)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">Неизрасходованный остаток</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
                <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(summary.claims.sumMisuse)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">Нецелевой расход</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
                <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(summary.claims.sumNoncompliance)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">Несоответствие требованиям договора гранта</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
                <p className="font-display text-sm font-semibold text-done">{summary.claims.resolvedCount}</p>
                <p className="mt-0.5 text-xs text-ink-soft">исполнено</p>
              </div>
            </div>
            <p className="mt-2 text-sm">
              {summary.claims.outstandingCount === 0 ? (
                <span className="text-done">Все требования о возврате исполнены.</span>
              ) : (
                <span className="text-urgent">
                  Не исполнено: {summary.claims.outstandingCount} на {formatRubRounded(summary.claims.sumOutstandingBalance)}
                </span>
              )}
            </p>
          </>
        )}
      </div>

      {drilldown && <DrilldownPanel drilldown={drilldown} onClose={() => setDrilldown(null)} />}
    </div>
  )
}

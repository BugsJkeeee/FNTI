'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { baseKind, isApplication, ridStages, ridYear } from '@/lib/rids'
import type { ProjectRid } from '@/types'

export type RidWithProject = ProjectRid & {
  project: { id: string; number: number; code: string; wave: number; tech_direction: string; status: string }
}

type Split = { granted: number; apps: number }

function addTo(map: Map<string, Split>, key: string, app: boolean) {
  const cur = map.get(key) ?? { granted: 0, apps: 0 }
  if (app) cur.apps++
  else cur.granted++
  map.set(key, cur)
}

function SplitBar({ split, max }: { split: Split; max: number }) {
  const scale = max > 0 ? 100 / max : 0
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-line"
      title={`Оформлено: ${split.granted}, заявок: ${split.apps}`}
    >
      <div className="h-full bg-teal" style={{ width: `${split.granted * scale}%` }} />
      <div className="h-full bg-normal" style={{ width: `${split.apps * scale}%` }} />
    </div>
  )
}

function Stat({ value, label, hint }: { value: number | string; label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
      <p className="font-display text-sm font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
      {hint && <p className="text-[11px] text-ink-soft">{hint}</p>}
    </div>
  )
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-ink-soft">{note}</p>}
      <div className="mt-3 space-y-2.5">{children}</div>
    </div>
  )
}

export default function RidAnalytics({
  rids,
  includedProjectIds,
  onSelectDirection,
}: {
  rids: RidWithProject[]
  includedProjectIds: Set<string>
  onSelectDirection: (direction: string) => void
}) {
  const stats = useMemo(() => {
    const list = rids.filter((r) => includedProjectIds.has(r.project.id))
    const byDirection = new Map<string, Split>()
    const byType = new Map<string, Split>()
    const byYear = new Map<string, Split>()
    const byProject = new Map<string, { id: string; code: string; count: number }>()
    let created = 0
    let protectedCount = 0
    let used = 0
    let apps = 0

    for (const r of list) {
      const app = isApplication(r.kind)
      if (app) apps++
      addTo(byDirection, r.project.tech_direction || '—', app)
      addTo(byType, baseKind(r.kind), app)
      addTo(byYear, String(ridYear(r) ?? '—'), app)
      const st = ridStages(r)
      if (st.created) created++
      if (st.protected) protectedCount++
      if (st.used) used++
      const p = byProject.get(r.project.id) ?? { id: r.project.id, code: r.project.code || `№${r.project.number}`, count: 0 }
      p.count++
      byProject.set(r.project.id, p)
    }

    const sortBySize = (m: Map<string, Split>) =>
      [...m.entries()].sort((a, b) => b[1].granted + b[1].apps - (a[1].granted + a[1].apps))
    const dirs = sortBySize(byDirection)
    const types = sortBySize(byType)
    const years = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const maxOf = (rows: [string, Split][]) => Math.max(0, ...rows.map(([, s]) => s.granted + s.apps))

    return {
      total: list.length,
      apps,
      granted: list.length - apps,
      created,
      protectedCount,
      used,
      projectsWithRid: byProject.size,
      dirs,
      types,
      years,
      maxDir: maxOf(dirs),
      maxType: maxOf(types),
      maxYear: maxOf(years),
      topProjects: [...byProject.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    }
  }, [rids, includedProjectIds])

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">РИД</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Результаты интеллектуальной деятельности по выбранным проектам (реестр РИД на 30.09.2026).
      </p>

      {stats.total === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">По выбранным проектам РИД нет.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
            <Stat value={stats.total} label="всего РИД" hint={`в ${stats.projectsWithRid} проектах`} />
            <Stat value={stats.granted} label="оформлено" />
            <Stat value={stats.apps} label="заявки поданы" />
            <Stat value={stats.created} label="ЕГИСУ: создание" />
            <Stat value={stats.protectedCount} label="правовая охрана" />
            <Stat value={stats.used} label="использование" />
          </div>

          <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-teal" />оформлено</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-normal" />заявка подана</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="По направлениям" note="Клик по строке — отфильтровать страницу по направлению.">
              {stats.dirs.map(([direction, split]) => (
                <button key={direction} onClick={() => onSelectDirection(direction)} className="block w-full text-left transition hover:opacity-80">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink">{direction}</span>
                    <span className="shrink-0 font-mono text-xs text-ink">{split.granted + split.apps}</span>
                  </div>
                  <div className="mt-1"><SplitBar split={split} max={stats.maxDir} /></div>
                </button>
              ))}
            </Panel>

            <div className="space-y-3">
              <Panel title="По типам">
                {stats.types.map(([kind, split]) => (
                  <div key={kind}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">{kind}</span>
                      <span className="shrink-0 font-mono text-xs text-ink">
                        {split.granted + split.apps}
                        {split.apps > 0 && <span className="text-ink-soft"> (заявок {split.apps})</span>}
                      </span>
                    </div>
                    <div className="mt-1"><SplitBar split={split} max={stats.maxType} /></div>
                  </div>
                ))}
              </Panel>

              <Panel title="По годам" note="Год — по дате заявки.">
                {stats.years.map(([year, split]) => (
                  <div key={year}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-mono text-ink">{year}</span>
                      <span className="font-mono text-xs text-ink">{split.granted + split.apps}</span>
                    </div>
                    <div className="mt-1"><SplitBar split={split} max={stats.maxYear} /></div>
                  </div>
                ))}
              </Panel>
            </div>
          </div>

          <div className="mt-3">
            <Panel title="Проекты с наибольшим числом РИД">
              <div className="flex flex-wrap gap-2">
                {stats.topProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="rounded-full border border-line px-3 py-1 text-xs text-ink transition hover:border-teal hover:text-teal"
                  >
                    {p.code} · {p.count}
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

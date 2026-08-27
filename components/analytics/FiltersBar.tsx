'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMultiSelectParam } from '@/lib/hooks/useMultiSelectParam'
import { SearchIcon } from './icons'
import CategoryDropdown from './CategoryDropdown'
import { STATUS_LABELS, STATUS_ORDER } from './constants'
import type { ProjectForAnalytics } from '@/lib/project-risk'

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

export function useAnalyticsFilters(projects: ProjectForAnalytics[]) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const waveKeys = [...new Set(projects.map((p) => String(p.wave)))].sort((a, b) => Number(a) - Number(b))
  const statusKeys = STATUS_ORDER.filter((s) => projects.some((p) => p.status === s))
  const directionKeys = [...new Set(projects.map((p) => p.tech_direction).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'))

  const wave = useMultiSelectParam('wave', waveKeys)
  const status = useMultiSelectParam('status', statusKeys)
  const direction = useMultiSelectParam('direction', directionKeys)
  const search = searchParams.get('q') ?? ''
  const onlyRisk = searchParams.get('risk') === '1'

  function setSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) params.set('q', value)
    else params.delete('q')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function setOnlyRisk(value: boolean) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('risk', '1')
    else params.delete('risk')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function reset() {
    router.replace(pathname, { scroll: false })
  }

  const isDefault = wave.allSelected && status.allSelected && direction.allSelected && !search.trim() && !onlyRisk

  const includedProjectIds = new Set(
    projects
      .filter((p) => wave.selected.has(String(p.wave)))
      .filter((p) => status.selected.has(p.status))
      .filter((p) => direction.selected.has(p.tech_direction))
      .filter((p) => !search.trim() || (p.code || `№${p.number}`).toLowerCase().includes(search.trim().toLowerCase()))
      .map((p) => p.id)
  )

  return { wave, status, direction, search, setSearch, onlyRisk, setOnlyRisk, reset, isDefault, includedProjectIds, waveKeys, statusKeys, directionKeys }
}

export type AnalyticsFilters = ReturnType<typeof useAnalyticsFilters>

export default function FiltersBar({ projects, filters }: { projects: ProjectForAnalytics[]; filters: AnalyticsFilters }) {
  const byWave = groupBy(projects, (p) => String(p.wave))
  const byStatus = groupBy(projects, (p) => p.status)
  const byDirection = groupBy(projects, (p) => p.tech_direction)

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Поиск проекта по шифру…"
            className="w-full rounded-lg border border-line bg-paper py-1.5 pl-8 pr-3 text-sm outline-none focus:border-teal"
          />
        </div>
        <CategoryDropdown
          label="Волна"
          options={filters.waveKeys.map((k) => ({ key: k, label: `${k} волна`, count: byWave.get(k)?.length ?? 0 }))}
          selected={filters.wave.selected}
          onToggle={filters.wave.toggle}
          allSelected={filters.wave.allSelected}
        />
        <CategoryDropdown
          label="Статус"
          options={filters.statusKeys.map((k) => ({ key: k, label: STATUS_LABELS[k], count: byStatus.get(k)?.length ?? 0 }))}
          selected={filters.status.selected}
          onToggle={filters.status.toggle}
          allSelected={filters.status.allSelected}
        />
        <CategoryDropdown
          label="Направление"
          options={filters.directionKeys.map((k) => ({ key: k, label: k, count: byDirection.get(k)?.length ?? 0 }))}
          selected={filters.direction.selected}
          onToggle={filters.direction.toggle}
          allSelected={filters.direction.allSelected}
        />
        <label className="ml-1 flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={filters.onlyRisk} onChange={(e) => filters.setOnlyRisk(e.target.checked)} />
          Только с рисками
        </label>
        {!filters.isDefault && (
          <button type="button" onClick={filters.reset} className="ml-auto text-xs text-teal hover:opacity-80">
            ↻ Сбросить
          </button>
        )}
      </div>
    </div>
  )
}

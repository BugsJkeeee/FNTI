'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { DirectionSubsidyPlan } from '@/types'

function formatRub(n: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₽'
}

// Уровень исполнения плана: ≥90% — хорошо, ≥50% — внимание, ниже — отстаём.
type Level = 'high' | 'mid' | 'low'
function level(pct: number): Level {
  return pct >= 90 ? 'high' : pct >= 50 ? 'mid' : 'low'
}
const TEXT: Record<Level, string> = { high: 'text-done', mid: 'text-normal', low: 'text-urgent' }
const BADGE: Record<Level, string> = { high: 'bg-low-soft text-done', mid: 'bg-normal-soft text-normal', low: 'bg-urgent-soft text-urgent' }
const BAR: Record<Level, string> = { high: 'bg-done', mid: 'bg-normal', low: 'bg-urgent' }

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full ${BAR[level(pct)]}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

function EditableCell({ amount, onSave, bold }: { amount: number | null; onSave: (amount: number) => Promise<void>; bold?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setValue(amount ? amount.toString() : '')
    setEditing(true)
  }

  async function save() {
    const trimmed = value.trim()
    if (trimmed === '') {
      setEditing(false)
      return
    }
    const num = Number(trimmed)
    if (Number.isNaN(num) || num === amount) {
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(num)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        autoFocus
        disabled={saving}
        className="w-36 rounded-md border border-line bg-paper px-2 py-1 text-right text-sm outline-none focus:border-teal"
      />
    )
  }

  if (!amount) {
    return (
      <button
        onClick={startEdit}
        title="Задать план"
        className="rounded-full bg-paper px-2 py-px text-[11px] text-ink-soft transition hover:text-teal"
      >
        —
      </button>
    )
  }

  return (
    <button
      onClick={startEdit}
      title="Изменить план"
      className={`whitespace-nowrap text-sm tabular-nums text-ink transition hover:text-teal ${bold ? 'font-semibold' : ''}`}
    >
      {formatRub(amount)}
    </button>
  )
}

// Ячейка «план / факт»: план (редактируемый для направлений), факт, бейдж %, полоска — для текущего года.
function PlanFactCell({
  plan,
  released,
  showBar,
  onSave,
}: {
  plan: number
  released: number
  showBar: boolean
  onSave?: (amount: number) => Promise<void>
}) {
  const pct = plan > 0 ? (released / plan) * 100 : null
  return (
    <td className="px-3.5 py-2.5 text-right align-middle tabular-nums">
      {onSave ? (
        <EditableCell amount={plan || null} onSave={onSave} bold />
      ) : (
        <div className="whitespace-nowrap text-sm font-semibold text-ink">{plan ? formatRub(plan) : '—'}</div>
      )}
      {released > 0 && <div className="mt-px whitespace-nowrap text-xs text-ink-soft">{formatRub(released)}</div>}
      {pct !== null ? (
        <>
          <span className={`mt-1 inline-block rounded-full px-2 py-px text-[11px] font-semibold ${BADGE[level(pct)]}`}>
            {Math.round(pct)}%
          </span>
          {showBar && <Bar pct={pct} className="ml-auto mt-1 h-[3px] w-12" />}
        </>
      ) : (
        released > 0 && <span className="mt-1 inline-block rounded-full bg-paper px-2 py-px text-[11px] text-ink-soft">план не задан</span>
      )}
    </td>
  )
}

export default function DirectionSubsidyPlans({
  plans,
  directions,
  released,
}: {
  plans: DirectionSubsidyPlan[]
  directions: string[]
  // `${направление}|${год}` → доведено фактически
  released: Record<string, number>
}) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  // Год, добавленный кнопкой «+ год» для ввода плана наперёд (пока в нём нет ни плана, ни факта).
  const [extraYear, setExtraYear] = useState<number | null>(null)

  const allDirections = useMemo(
    () => [...new Set([...directions, ...plans.map((p) => p.tech_direction)])].sort((a, b) => a.localeCompare(b, 'ru')),
    [directions, plans]
  )
  const cellMap = useMemo(() => {
    const map = new Map<string, number>()
    plans.forEach((p) => map.set(`${p.tech_direction}|${p.year}`, Number(p.amount) || 0))
    return map
  }, [plans])
  const years = useMemo(() => {
    const set = new Set<number>([currentYear])
    plans.forEach((p) => Number(p.amount) > 0 && set.add(p.year))
    Object.keys(released).forEach((k) => set.add(Number(k.split('|')[1])))
    if (extraYear) set.add(extraYear)
    return [...set].sort((a, b) => a - b)
  }, [plans, released, currentYear, extraYear])

  const totals = years.map((year) => ({
    year,
    plan: allDirections.reduce((s, d) => s + (cellMap.get(`${d}|${year}`) ?? 0), 0),
    released: allDirections.reduce((s, d) => s + (released[`${d}|${year}`] ?? 0), 0),
  }))
  const summaryYears = totals.filter((t) => t.plan > 0 || t.released > 0)

  async function saveCell(direction: string, year: number, amount: number) {
    const supabase = createClient()
    await supabase.from('direction_subsidy_plans').upsert({ tech_direction: direction, year, amount }, { onConflict: 'tech_direction,year' })
    router.refresh()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-1 border-b border-line sm:grid-cols-3">
        {summaryYears.map((t) => {
          const pct = t.plan > 0 ? (t.released / t.plan) * 100 : 0
          return (
            <div key={t.year} className="border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.year}</div>
              <div className="text-lg font-bold tabular-nums tracking-tight text-ink">{formatRub(t.released)}</div>
              <div className="mb-2.5 text-xs tabular-nums text-ink-soft">{t.plan > 0 ? `из ${formatRub(t.plan)}` : 'план не задан'}</div>
              {t.plan > 0 && (
                <>
                  <Bar pct={pct} className="mb-1.5 h-[5px]" />
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-ink-soft">Доведено</span>
                    <span className={TEXT[level(pct)]}>{Math.round(pct)}%</span>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-paper">
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="w-[32%] px-3.5 py-2.5 text-left font-semibold">Направление</th>
              {years.map((year) => (
                <th key={year} className="whitespace-nowrap px-3.5 py-2.5 text-right font-semibold">
                  {year} план / факт
                </th>
              ))}
              <th className="px-3.5 py-2.5 text-right font-semibold">
                <button
                  onClick={() => setExtraYear(Math.max(...years) + 1)}
                  title="Добавить столбец следующего года, чтобы внести план"
                  className="normal-case text-teal hover:underline"
                >
                  + год
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {allDirections.map((direction) => (
              <tr key={direction} className="border-b border-line hover:bg-paper/60">
                <td className="max-w-[340px] px-3.5 py-2.5 align-middle font-medium leading-snug text-ink">{direction}</td>
                {years.map((year) => (
                  <PlanFactCell
                    key={year}
                    plan={cellMap.get(`${direction}|${year}`) ?? 0}
                    released={released[`${direction}|${year}`] ?? 0}
                    showBar={year === currentYear}
                    onSave={(amount) => saveCell(direction, year, amount)}
                  />
                ))}
                <td />
              </tr>
            ))}
            <tr className="bg-paper">
              <td className="px-3.5 py-3 align-middle font-bold text-ink">Итого</td>
              {totals.map((t) => (
                <PlanFactCell key={t.year} plan={t.plan} released={t.released} showBar={t.year === currentYear} />
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

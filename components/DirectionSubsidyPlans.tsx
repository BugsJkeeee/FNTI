'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { DirectionSubsidyPlan } from '@/types'

const DEFAULT_YEARS = [2026, 2027, 2028]

function formatRub(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽'
}

function EditableCell({ amount, onSave }: { amount: number | null; onSave: (amount: number) => Promise<void> }) {
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
        className="w-32 rounded-md border border-line bg-paper px-2 py-1 text-sm outline-none focus:border-teal"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className={`font-mono text-sm transition hover:text-teal ${amount ? 'text-ink' : 'text-ink-soft'}`}
    >
      {amount ? formatRub(amount) : '—'}
    </button>
  )
}

export default function DirectionSubsidyPlans({
  plans,
  directions,
}: {
  plans: DirectionSubsidyPlan[]
  directions: string[]
}) {
  const router = useRouter()

  const allDirections = useMemo(
    () => [...new Set([...directions, ...plans.map((p) => p.tech_direction)])].sort((a, b) => a.localeCompare(b, 'ru')),
    [directions, plans]
  )
  const years = useMemo(
    () => [...new Set([...DEFAULT_YEARS, ...plans.map((p) => p.year)])].sort((a, b) => a - b),
    [plans]
  )
  const cellMap = useMemo(() => {
    const map = new Map<string, DirectionSubsidyPlan>()
    plans.forEach((p) => map.set(`${p.tech_direction}|${p.year}`, p))
    return map
  }, [plans])

  async function saveCell(direction: string, year: number, amount: number) {
    const supabase = createClient()
    await supabase.from('direction_subsidy_plans').upsert({ tech_direction: direction, year, amount }, { onConflict: 'tech_direction,year' })
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">План субсидии по направлениям</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Официальный план по документам на текущий и будущие годы — вручную, для сверки с фактом доведения по проектам.
        Клик по сумме — редактировать.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-soft">
              <th className="py-2 pr-4 font-medium">Направление</th>
              {years.map((year) => (
                <th key={year} className="py-2 pr-4 font-medium">{year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDirections.map((direction) => (
              <tr key={direction} className="border-b border-line last:border-0">
                <td className="py-2 pr-4 text-ink">{direction}</td>
                {years.map((year) => (
                  <td key={year} className="py-2 pr-4">
                    <EditableCell
                      amount={cellMap.get(`${direction}|${year}`)?.amount ?? null}
                      onSave={(amount) => saveCell(direction, year, amount)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

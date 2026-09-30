'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { DirectionGrbsDecision } from '@/types'

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : '—'
}

const FIELD_META = {
  subsidy_ministry: { label: 'Министерство', type: 'text' },
  subsidy_agreement_number: { label: '№ соглашения', type: 'text' },
  subsidy_agreement_date: { label: 'Дата соглашения', type: 'date' },
  subsidy_decision_number: { label: '№ решения', type: 'text' },
  subsidy_decision_date: { label: 'Дата решения', type: 'date' },
  subsidy_identifier: { label: 'Идентификатор субсидии', type: 'text' },
} as const

type FieldKey = keyof typeof FIELD_META

function emptyValues(decision: DirectionGrbsDecision | null): Record<FieldKey, string> {
  return Object.fromEntries((Object.keys(FIELD_META) as FieldKey[]).map((k) => [k, decision ? (decision[k] ?? '') : ''])) as Record<
    FieldKey,
    string
  >
}

function DecisionRow({
  direction,
  year,
  decision,
  onSaved,
}: {
  direction: string
  year: number
  decision: DirectionGrbsDecision | null
  onSaved: (d: DirectionGrbsDecision) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<FieldKey, string>>(() => emptyValues(decision))
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setValues(emptyValues(decision))
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        tech_direction: direction,
        year,
        subsidy_ministry: values.subsidy_ministry,
        subsidy_agreement_number: values.subsidy_agreement_number,
        subsidy_agreement_date: values.subsidy_agreement_date || null,
        subsidy_decision_number: values.subsidy_decision_number,
        subsidy_decision_date: values.subsidy_decision_date || null,
        subsidy_identifier: values.subsidy_identifier,
      }
      const { data, error } = await supabase
        .from('direction_grbs_decisions')
        .upsert(payload, { onConflict: 'tech_direction,year' })
        .select()
        .single()
      if (!error && data) {
        onSaved(data as DirectionGrbsDecision)
        setEditing(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    const hasData = !!decision && (decision.subsidy_ministry || decision.subsidy_decision_number)
    return (
      <div className="flex items-start justify-between gap-3 py-1.5">
        <div className="text-xs text-ink-soft">
          <span className="font-mono text-ink">{year}</span>{' '}
          {hasData ? (
            <>
              {decision!.subsidy_ministry && <>{decision!.subsidy_ministry}: </>}
              {decision!.subsidy_agreement_number &&
                `соглашение № ${decision!.subsidy_agreement_number} от ${formatDate(decision!.subsidy_agreement_date)}`}
              {decision!.subsidy_agreement_number && decision!.subsidy_decision_number && ', '}
              {decision!.subsidy_decision_number &&
                `решение № ${decision!.subsidy_decision_number} от ${formatDate(decision!.subsidy_decision_date)}`}
              {decision!.subsidy_identifier && `, идентификатор ${decision!.subsidy_identifier}`}
            </>
          ) : (
            'не задано'
          )}
        </div>
        <button onClick={startEdit} className="shrink-0 text-xs text-teal hover:opacity-80">
          {hasData ? 'изменить' : '+ задать'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-1.5 font-mono text-xs text-ink-soft">{year}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(FIELD_META) as FieldKey[]).map((key) => (
          <div key={key}>
            <label className="mb-1 block text-[11px] text-ink-soft">{FIELD_META[key].label}</label>
            <input
              type={FIELD_META[key].type}
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="w-full rounded-md border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-teal"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

const DEFAULT_YEARS = [2024, 2025, 2026]

export default function DirectionGrbsDecisions({
  decisions,
  directions,
}: {
  decisions: DirectionGrbsDecision[]
  directions: string[]
}) {
  const [localDecisions, setLocalDecisions] = useState(decisions)

  const byDirection = new Map<string, Map<number, DirectionGrbsDecision>>()
  localDecisions.forEach((d) => {
    const map = byDirection.get(d.tech_direction) ?? new Map()
    map.set(d.year, d)
    byDirection.set(d.tech_direction, map)
  })

  const years = [...new Set([...DEFAULT_YEARS, ...localDecisions.map((d) => d.year)])].sort((a, b) => a - b)

  function handleSaved(d: DirectionGrbsDecision) {
    setLocalDecisions((prev) => {
      const idx = prev.findIndex((x) => x.tech_direction === d.tech_direction && x.year === d.year)
      if (idx === -1) return [...prev, d]
      const next = [...prev]
      next[idx] = d
      return next
    })
  }

  return (
    <div className="space-y-3">
      {directions.map((direction) => (
        <div key={direction} className="border-t border-line pt-2 first:border-0 first:pt-0">
          <p className="text-sm font-medium text-ink">{direction}</p>
          <div className="mt-1 divide-y divide-line">
            {years.map((year) => (
              <DecisionRow
                key={year}
                direction={direction}
                year={year}
                decision={byDirection.get(direction)?.get(year) ?? null}
                onSaved={handleSaved}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

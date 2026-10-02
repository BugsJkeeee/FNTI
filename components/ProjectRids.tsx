'use client'

import { useState } from 'react'
import type { ProjectRid } from '@/types'
import { RID_KINDS, isApplication, ridStages } from '@/lib/rids'

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : '—'
}

type FormValues = Record<string, string>

const EMPTY: FormValues = {
  kind: RID_KINDS[0],
  title: '',
  application_number: '',
  application_date: '',
  document_number: '',
  action_status: '',
  egisu_created_number: '',
  egisu_created_date: '',
  egisu_protection_number: '',
  egisu_protection_date: '',
  egisu_usage_number: '',
  egisu_usage_date: '',
}

function toForm(rid: ProjectRid | null): FormValues {
  if (!rid) return { ...EMPTY }
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, String((rid as unknown as Record<string, unknown>)[k] ?? '')]))
}

const inputCls = 'w-full rounded-md border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-teal'

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-3' : ''}>
      <label className="mb-1 block text-[11px] text-ink-soft">{label}</label>
      {children}
    </div>
  )
}

function RidForm({
  initial,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  initial: ProjectRid | null
  saving: boolean
  error: string | null
  onSubmit: (values: FormValues) => void
  onCancel: () => void
}) {
  const [v, setV] = useState<FormValues>(() => toForm(initial))
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }))
  const text = (k: string) => <input value={v[k]} onChange={set(k)} className={inputCls} />
  const date = (k: string) => <input type="date" value={v[k]} onChange={set(k)} className={`${inputCls} font-mono`} />

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Вид РИД">
          <select value={v.kind} onChange={set('kind')} className={inputCls}>
            {RID_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="Статус действия">{text('action_status')}</Field>
        <Field label="Название РИД" wide>{text('title')}</Field>
        <Field label="№ заявки">{text('application_number')}</Field>
        <Field label="Дата заявки">{date('application_date')}</Field>
        <Field label="№ охранного документа">{text('document_number')}</Field>
        <Field label="ЕГИСУ о создании — №">{text('egisu_created_number')}</Field>
        <Field label="ЕГИСУ о создании — дата">{date('egisu_created_date')}</Field>
        <span className="hidden sm:block" />
        <Field label="ЕГИСУ о правовой охране — №">{text('egisu_protection_number')}</Field>
        <Field label="ЕГИСУ о правовой охране — дата">{date('egisu_protection_date')}</Field>
        <span className="hidden sm:block" />
        <Field label="ЕГИСУ об использовании — №">{text('egisu_usage_number')}</Field>
        <Field label="ЕГИСУ об использовании — дата">{date('egisu_usage_date')}</Field>
      </div>
      {error && <p className="mt-2 text-xs text-urgent">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onSubmit(v)}
          disabled={saving}
          className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

function Stamp({ on, label, date }: { on: boolean; label: string; date: string | null }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-teal bg-teal-soft text-teal' : 'border-line text-ink-soft'}`}>
      {label}
      {on && date ? ` · ${formatDate(date)}` : ''}
    </span>
  )
}

function RidRow({ rid, onEdit }: { rid: ProjectRid; onEdit: () => void }) {
  const st = ridStages(rid)
  const app = isApplication(rid.kind)
  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink">{rid.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            <span className={app ? 'text-normal' : 'text-ink'}>{rid.kind}</span>
            {rid.application_number && ` · заявка № ${rid.application_number}`}
            {rid.application_date && ` · дата заявки ${formatDate(rid.application_date)}`}
            {rid.document_number && ` · ОД № ${rid.document_number}`}
          </p>
        </div>
        <button onClick={onEdit} className="shrink-0 text-xs text-teal hover:opacity-80">изменить</button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {rid.action_status && <span className="rounded-full border border-normal px-2 py-0.5 text-[11px] text-normal">{rid.action_status}</span>}
        <Stamp on={st.created} label="ЕГИСУ: создание" date={rid.egisu_created_date} />
        <Stamp on={st.protected} label="правовая охрана" date={rid.egisu_protection_date} />
        <Stamp on={st.used} label="использование" date={rid.egisu_usage_date} />
      </div>
    </div>
  )
}

export default function ProjectRids({ projectId, initialRids }: { projectId: string; initialRids: ProjectRid[] }) {
  const [rids, setRids] = useState(initialRids)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...rids].sort(
    (a, b) => (b.application_date ?? '').localeCompare(a.application_date ?? '') || a.title.localeCompare(b.title, 'ru')
  )

  async function save(values: FormValues, id: string | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(id ? `/api/projects/${projectId}/rids/${id}` : `/api/projects/${projectId}/rids`, {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось сохранить')
        return
      }
      setRids((prev) => (id ? prev.map((r) => (r.id === id ? data : r)) : [...prev, data]))
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить РИД?')) return
    const res = await fetch(`/api/projects/${projectId}/rids/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRids((prev) => prev.filter((r) => r.id !== id))
      setEditingId(null)
    }
  }

  const granted = rids.filter((r) => !isApplication(r.kind)).length

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-ink">
        РИД{rids.length > 0 && <span className="ml-1.5 text-xs font-normal text-ink-soft">всего {rids.length}, оформлено {granted}, заявок {rids.length - granted}</span>}
      </h3>
      {rids.length === 0 && editingId !== 'new' && <p className="mt-2 text-xs text-ink-soft">РИД пока нет.</p>}
      <div className="mt-1 divide-y divide-line">
        {sorted.map((rid) =>
          editingId === rid.id ? (
            <div key={rid.id} className="py-2">
              <RidForm initial={rid} saving={saving} error={error} onSubmit={(v) => save(v, rid.id)} onCancel={() => setEditingId(null)} />
              <button onClick={() => remove(rid.id)} className="mt-1.5 text-xs text-ink-soft transition hover:text-urgent">удалить РИД</button>
            </div>
          ) : (
            <RidRow key={rid.id} rid={rid} onEdit={() => { setError(null); setEditingId(rid.id) }} />
          )
        )}
      </div>
      {editingId === 'new' ? (
        <div className="mt-2">
          <RidForm initial={null} saving={saving} error={error} onSubmit={(v) => save(v, null)} onCancel={() => setEditingId(null)} />
        </div>
      ) : (
        <button onClick={() => { setError(null); setEditingId('new') }} className="mt-3 text-xs text-teal hover:opacity-80">
          + добавить РИД
        </button>
      )}
    </div>
  )
}

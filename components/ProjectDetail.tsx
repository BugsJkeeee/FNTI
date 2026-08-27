'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, Project, ProjectChecklistItem, ProjectClaim, ProjectContract, ProjectPayment, ProjectStage, Task } from '@/types'
import { isStageClosed } from '@/lib/project-checklist-templates'
import { trackStatus } from '@/lib/project-status'
import ProjectChecklist from '@/components/ProjectChecklist'
import ProjectComments from '@/components/ProjectComments'
import StageClaimsList from '@/components/StageClaimInfo'
import TaskForm from '@/components/TaskForm'
import TaskCard from '@/components/TaskCard'

function formatRub(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽'
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : '—'
}

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Действующий',
  terminating: 'Прекращаем',
  terminated: 'Прекращён',
}

const STATUS_BADGE_CLASS: Record<Project['status'], string> = {
  active: 'bg-teal-soft text-teal',
  terminating: 'bg-normal-soft text-normal',
  terminated: 'bg-urgent-soft text-urgent',
}

const HEADER_FIELDS = [
  { key: 'code', label: 'Шифр' },
  { key: 'topic', label: 'Тема НИОКР' },
  { key: 'tech_direction', label: 'Технологическое направление' },
  { key: 'executor_short', label: 'Исполнитель (кратко)' },
  { key: 'executor_full', label: 'Исполнитель (полное наименование)' },
  { key: 'executor_inn', label: 'ИНН' },
  { key: 'executor_kpp', label: 'КПП' },
  { key: 'executor_address', label: 'Адрес' },
] as const

function ProjectHeader({ project, isOwner, onSaved }: { project: Project; isOwner: boolean; onSaved: (patch: Partial<Project>) => void }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Удалить проект целиком вместе с этапами, чек-листами, договорами и комментариями? Это необратимо.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/projects')
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Не удалось удалить проект')
        setDeleting(false)
      }
    } catch {
      setDeleting(false)
    }
  }
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(HEADER_FIELDS.map((f) => [f.key, project[f.key] ?? ''])),
    protocol_number: project.protocol_number ?? '',
    protocol_date: project.protocol_date ?? '',
    status: project.status,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось сохранить')
        return
      }
      onSaved(values)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-ink-soft">ID {project.number} · {project.wave} волна</div>
            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="font-display text-xl font-semibold text-ink">{project.code}</h1>
              <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${STATUS_BADGE_CLASS[project.status]}`}>
                {STATUS_LABEL[project.status]}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-teal hover:text-teal"
            >
              Редактировать
            </button>
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-urgent hover:text-urgent disabled:opacity-50"
              >
                {deleting ? 'Удаляю…' : 'Удалить проект'}
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-ink">{project.topic || '—'}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <div><span className="text-ink-soft">Направление</span><div className="mt-0.5 text-ink">{project.tech_direction || '—'}</div></div>
          <div><span className="text-ink-soft">Исполнитель</span><div className="mt-0.5 text-ink">{project.executor_short || '—'}</div></div>
          <div><span className="text-ink-soft">ИНН / КПП</span><div className="mt-0.5 font-mono text-ink">{project.executor_inn || '—'} / {project.executor_kpp || '—'}</div></div>
        </div>
        {(project.executor_full || project.executor_address) && (
          <div className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-ink-soft">
            {project.executor_full && <p>{project.executor_full}</p>}
            {project.executor_address && <p>Адрес: {project.executor_address}</p>}
          </div>
        )}
        {project.protocol_number && (
          <p className="mt-2 text-xs text-ink-soft">
            Протокол подведения итогов конкурсного отбора от {formatDate(project.protocol_date)} № {project.protocol_number}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {HEADER_FIELDS.map((f) => (
          <div key={f.key} className={f.key === 'topic' || f.key === 'executor_full' || f.key === 'executor_address' ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</label>
            {f.key === 'topic' ? (
              <textarea
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
              />
            ) : (
              <input
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
              />
            )}
          </div>
        ))}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Номер протокола подведения итогов</label>
          <input
            value={values.protocol_number}
            onChange={(e) => setValues((v) => ({ ...v, protocol_number: e.target.value }))}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Дата протокола</label>
          <input
            type="date"
            value={values.protocol_date}
            onChange={(e) => setValues((v) => ({ ...v, protocol_date: e.target.value }))}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Статус проекта</label>
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          >
            <option value="active">Действующий</option>
            <option value="terminating">Прекращаем</option>
            <option value="terminated">Прекращён</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button onClick={() => setEditing(false)} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft hover:text-ink">
          Отмена
        </button>
      </div>
    </div>
  )
}

function ContractRow({ projectId, contract, onSaved }: { projectId: string; contract: ProjectContract; onSaved: (c: ProjectContract) => void }) {
  const [editing, setEditing] = useState(false)
  const [akr, setAkr] = useState(contract.akr)
  const [saving, setSaving] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState(contract.invoice_number)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [editingStage, setEditingStage] = useState(false)
  const [stageNumber, setStageNumber] = useState(contract.stage_number?.toString() ?? '')
  const [savingStage, setSavingStage] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [contractDate, setContractDate] = useState(contract.contract_date ?? '')
  const [savingDate, setSavingDate] = useState(false)
  const [showAgreements, setShowAgreements] = useState(false)
  const [agreements, setAgreements] = useState<{ number: string; date: string }[]>(() =>
    contract.additional_agreements.map((a) => ({ number: a.number, date: a.date ?? '' }))
  )
  const [agreementsDirty, setAgreementsDirty] = useState(false)
  const [savingAgreements, setSavingAgreements] = useState(false)

  function startEditing() {
    setAkr(contract.akr)
    setEditing(true)
  }

  async function saveAkr() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ akr }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function startEditingInvoice() {
    setInvoiceNumber(contract.invoice_number)
    setEditingInvoice(true)
  }

  async function saveInvoiceNumber() {
    setSavingInvoice(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_number: invoiceNumber }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        setEditingInvoice(false)
      }
    } finally {
      setSavingInvoice(false)
    }
  }

  function startEditingStage() {
    setStageNumber(contract.stage_number?.toString() ?? '')
    setEditingStage(true)
  }

  async function saveStage() {
    setSavingStage(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_number: stageNumber || null }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        setEditingStage(false)
      }
    } finally {
      setSavingStage(false)
    }
  }

  function startEditingDate() {
    setContractDate(contract.contract_date ?? '')
    setEditingDate(true)
  }

  async function saveDate() {
    setSavingDate(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_date: contractDate || null }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        setEditingDate(false)
      }
    } finally {
      setSavingDate(false)
    }
  }

  function setAgreementField(i: number, field: 'number' | 'date', value: string) {
    setAgreements((a) => a.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
    setAgreementsDirty(true)
  }

  async function saveAgreements() {
    setSavingAgreements(true)
    try {
      const clean = agreements.filter((a) => a.number || a.date).map((a) => ({ number: a.number, date: a.date || null }))
      const res = await fetch(`/api/projects/${projectId}/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additional_agreements: clean }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        setAgreementsDirty(false)
      }
    } finally {
      setSavingAgreements(false)
    }
  }

  return (
    <li>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-soft">{contract.contract_number} от</span>
        {editingDate ? (
          <span className="flex items-center gap-1 text-xs">
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-xs outline-none focus:border-teal"
            />
            <button onClick={saveDate} disabled={savingDate} className="text-teal hover:opacity-80 disabled:opacity-50">
              {savingDate ? '…' : 'ОК'}
            </button>
            <button onClick={() => setEditingDate(false)} className="text-ink-soft hover:text-ink">×</button>
          </span>
        ) : (
          <button onClick={startEditingDate} className="font-mono text-xs text-ink-soft transition hover:text-teal">
            {contract.contract_date ? formatDate(contract.contract_date) : '+ добавить дату'}
          </button>
        )}
        {editingStage ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-ink-soft">этап с</span>
            <input
              type="number"
              min={1}
              value={stageNumber}
              onChange={(e) => setStageNumber(e.target.value)}
              placeholder="—"
              className="w-12 rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs outline-none focus:border-teal"
            />
            <button onClick={saveStage} disabled={savingStage} className="text-teal hover:opacity-80 disabled:opacity-50">
              {savingStage ? '…' : 'ОК'}
            </button>
            <button onClick={() => setEditingStage(false)} className="text-ink-soft hover:text-ink">×</button>
          </span>
        ) : (
          <button onClick={startEditingStage} className="font-mono text-xs text-ink-soft transition hover:text-teal">
            {contract.stage_number ? `(этап ${contract.stage_number})` : contract.contract_year ? `(${contract.contract_year})` : '(этап —)'}
          </button>
        )}
        {editingInvoice ? (
          <>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Номер счёта"
              autoFocus
              className="w-32 rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink outline-none focus:border-teal"
            />
            <button
              onClick={saveInvoiceNumber}
              disabled={savingInvoice}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
            >
              {savingInvoice ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button
              onClick={() => setEditingInvoice(false)}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
            >
              Отмена
            </button>
          </>
        ) : contract.invoice_number ? (
          <button onClick={startEditingInvoice} className="font-mono text-xs text-ink-soft transition hover:text-teal">
            Счёт: {contract.invoice_number}
          </button>
        ) : (
          <button onClick={startEditingInvoice} className="text-xs text-teal hover:opacity-80">+ добавить номер счёта</button>
        )}
        {editing ? (
          <>
            <input
              value={akr}
              onChange={(e) => setAkr(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
              maxLength={8}
              placeholder="АКР"
              autoFocus
              className="w-24 rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink outline-none focus:border-teal"
            />
            <button
              onClick={saveAkr}
              disabled={saving}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
            >
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
            >
              Отмена
            </button>
          </>
        ) : contract.akr ? (
          <button onClick={startEditing} className="font-mono text-xs text-ink-soft transition hover:text-teal">
            АКР: {contract.akr}
          </button>
        ) : (
          <button onClick={startEditing} className="text-xs text-teal hover:opacity-80">+ добавить АКР</button>
        )}
        <button onClick={() => setShowAgreements((s) => !s)} className="text-xs text-ink-soft transition hover:text-teal">
          {agreements.length > 0 ? `доп. соглашения (${agreements.length})` : '+ доп. соглашение'}
        </button>
      </div>
      {showAgreements && (
        <div className="mt-1.5 space-y-1">
          {agreements.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={a.number}
                onChange={(e) => setAgreementField(i, 'number', e.target.value)}
                placeholder="№ доп. соглашения"
                className="w-36 rounded-md border border-line bg-paper px-1.5 py-0.5 text-[11px] text-ink outline-none focus:border-teal"
              />
              <input
                type="date"
                value={a.date}
                onChange={(e) => setAgreementField(i, 'date', e.target.value)}
                className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-soft outline-none focus:border-teal"
              />
              <button
                onClick={() => {
                  setAgreements((arr) => arr.filter((_, idx) => idx !== i))
                  setAgreementsDirty(true)
                }}
                className="text-[11px] text-ink-soft hover:text-urgent"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Номер и порядковый суффикс предзаполняем сами — так меньше риск опечататься
                // в номере договора при ручном вводе.
                setAgreements((a) => [...a, { number: `${contract.contract_number}/${a.length + 1}`, date: '' }])
                setAgreementsDirty(true)
              }}
              className="text-[11px] text-teal hover:opacity-80"
            >
              + добавить
            </button>
            {agreementsDirty && (
              <button
                onClick={saveAgreements}
                disabled={savingAgreements}
                className="rounded-md border border-line px-2 py-0.5 text-[11px] text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
              >
                {savingAgreements ? '…' : 'OK'}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function ContractsCard({
  projectId,
  contracts,
  stageNumbers,
  onAdded,
  onSaved,
  bare,
}: {
  projectId: string
  contracts: ProjectContract[]
  stageNumbers: number[]
  onAdded: (c: ProjectContract) => void
  onSaved: (c: ProjectContract) => void
  bare?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [number, setNumber] = useState('')
  const [date, setDate] = useState('')
  const [stageNumber, setStageNumber] = useState(stageNumbers[0]?.toString() ?? '1')
  const [akr, setAkr] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!number.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_number: number, contract_date: date || null, stage_number: stageNumber ? Number(stageNumber) : null, akr }),
      })
      const data = await res.json()
      if (res.ok) {
        onAdded(data)
        setNumber('')
        setDate('')
        setAkr('')
        setAdding(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={bare ? '' : 'rounded-2xl border border-line bg-white p-5'}>
      <h2 className="font-display text-base font-semibold text-ink">Договоры</h2>
      {contracts.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Договоров пока нет.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {[...contracts]
            .sort((a, b) => (a.contract_date ?? '9999-99-99').localeCompare(b.contract_date ?? '9999-99-99'))
            .map((c) => (
              <ContractRow key={c.id} projectId={projectId} contract={c} onSaved={onSaved} />
            ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Номер договора" className="w-36 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="w-36 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
          <select
            value={stageNumber}
            onChange={(e) => setStageNumber(e.target.value)}
            className="w-24 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal"
          >
            {(stageNumbers.length ? stageNumbers : [1, 2, 3]).map((n) => (
              <option key={n} value={n}>Этап {n}</option>
            ))}
          </select>
          <input
            value={akr}
            onChange={(e) => setAkr(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputMode="numeric"
            maxLength={8}
            placeholder="АКР"
            className="w-28 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal"
          />
          <button type="submit" disabled={saving} className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50">
            {saving ? 'Добавляю…' : 'Добавить'}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
          >
            Отмена
          </button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 text-xs text-teal hover:opacity-80">+ добавить договор</button>
      )}
    </div>
  )
}

function ClosedStageSummary({
  projectId,
  stage,
  onItemUpdate,
  onItemAdd,
  onItemDelete,
  onClaimAdded,
  onClaimSaved,
  onClaimDeleted,
}: {
  projectId: string
  stage: ProjectStage
  onItemUpdate: (item: ProjectChecklistItem) => void
  onItemAdd: (item: ProjectChecklistItem) => void
  onItemDelete: (itemId: string) => void
  onClaimAdded: (c: ProjectClaim) => void
  onClaimSaved: (c: ProjectClaim) => void
  onClaimDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const items = stage.checklist_items ?? []
  const techStatus = trackStatus(stage, 'technical')
  const finStatus = trackStatus(stage, 'financial')
  const techItems = items.filter((i) => i.track === 'technical')
  const finItems = items.filter((i) => i.track === 'financial')

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-mono text-ink-soft">{formatDate(stage.start_date)} – {formatDate(stage.end_date)} · {formatRub(stage.cost)}</span>
        <button onClick={() => setExpanded((e) => !e)} className="text-xs text-teal hover:opacity-80">
          {expanded ? 'Свернуть' : 'Развернуть все шаги'}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <div>
          <div className="font-medium text-ink-soft">Техническая приёмка</div>
          <div className="mt-0.5 text-done">{techStatus.text}</div>
        </div>
        <div>
          <div className="font-medium text-ink-soft">Финансовая приёмка</div>
          <div className="mt-0.5 text-done">{finStatus.text}</div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <ProjectChecklist
            projectId={projectId}
            stageId={stage.id}
            track="technical"
            items={techItems}
            onItemUpdate={onItemUpdate}
            onItemAdd={onItemAdd}
            onItemDelete={onItemDelete}
          />
          <ProjectChecklist
            projectId={projectId}
            stageId={stage.id}
            track="financial"
            items={finItems}
            onItemUpdate={onItemUpdate}
            onItemAdd={onItemAdd}
            onItemDelete={onItemDelete}
            claims={stage.claims ?? []}
            onClaimAdded={onClaimAdded}
            onClaimSaved={onClaimSaved}
            onClaimDeleted={onClaimDeleted}
          />
        </div>
      )}
    </div>
  )
}

function StageCard({
  projectId,
  stage,
  locked,
  onStageSave,
  onStageDelete,
  onItemUpdate,
  onItemAdd,
  onItemDelete,
  onClaimAdded,
  onClaimSaved,
  onClaimDeleted,
}: {
  projectId: string
  stage: ProjectStage
  locked: boolean
  onStageSave: (patch: Partial<ProjectStage>) => void
  onStageDelete: () => void
  onItemUpdate: (item: ProjectChecklistItem) => void
  onItemAdd: (item: ProjectChecklistItem) => void
  onItemDelete: (itemId: string) => void
  onClaimAdded: (c: ProjectClaim) => void
  onClaimSaved: (c: ProjectClaim) => void
  onClaimDeleted: (id: string) => void
}) {
  const closed = isStageClosed(stage.checklist_items ?? [])
  const [editingDates, setEditingDates] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [startDate, setStartDate] = useState(stage.start_date ?? '')
  const [endDate, setEndDate] = useState(stage.end_date ?? '')
  const [cost, setCost] = useState(stage.cost?.toString() ?? '')

  const techItems = (stage.checklist_items ?? []).filter((i) => i.track === 'technical')
  const finItems = (stage.checklist_items ?? []).filter((i) => i.track === 'financial')
  const techStatus = trackStatus(stage, 'technical')
  const finStatus = trackStatus(stage, 'financial')

  function saveDates() {
    onStageSave({ start_date: startDate || null, end_date: endDate || null, cost: cost ? Number(cost) : null })
    setEditingDates(false)
  }

  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-paper p-5 opacity-60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-ink-soft">
            Этап {stage.stage_number}
            <span className="ml-2 rounded-full bg-line px-2 py-0.5 font-mono text-[11px] font-medium text-ink-soft">неактивен</span>
          </h3>
          <button onClick={onStageDelete} className="text-xs text-ink-soft transition hover:text-urgent">удалить этап</button>
        </div>
        <p className="mt-1 font-mono text-xs text-ink-soft">{formatDate(stage.start_date)} – {formatDate(stage.end_date)} · {formatRub(stage.cost)}</p>
        <p className="mt-2 text-xs text-ink-soft">Откроется после закрытия технической и финансовой приёмки предыдущего этапа.</p>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 ${closed ? 'border-done/30 bg-low-soft' : 'border-line bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-ink">
          Этап {stage.stage_number}
          {!closed && <span className="ml-2 rounded-full bg-teal-soft px-2 py-0.5 font-mono text-[11px] font-medium text-teal">текущий</span>}
          {closed && <span className="ml-2 rounded-full bg-done/15 px-2 py-0.5 font-mono text-[11px] font-medium text-done">принят</span>}
        </h3>
        <div className="flex items-center gap-2">
          {!closed && !editingDates && (
            <button onClick={() => setEditingDates(true)} className="text-xs text-ink-soft transition hover:text-teal">
              изменить сроки/сумму
            </button>
          )}
          {!closed && (
            <button onClick={() => setExpanded((e) => !e)} className="text-xs text-teal hover:opacity-80">
              {expanded ? 'Свернуть' : 'Развернуть'}
            </button>
          )}
          <button onClick={onStageDelete} className="text-xs text-ink-soft transition hover:text-urgent">удалить этап</button>
        </div>
      </div>

      {!closed && editingDates ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-ink-soft">Начало</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-soft">Окончание</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-soft">Сумма, ₽</label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-32 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
          </div>
          <button onClick={saveDates} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Сохранить</button>
          <button
            onClick={() => setEditingDates(false)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
          >
            Отмена
          </button>
        </div>
      ) : (
        !closed && (
          <p className="mt-1 font-mono text-xs text-ink-soft">{formatDate(stage.start_date)} – {formatDate(stage.end_date)} · {formatRub(stage.cost)}</p>
        )
      )}

      <div className="mt-4">
        {closed ? (
          <ClosedStageSummary
            projectId={projectId}
            stage={stage}
            onItemUpdate={onItemUpdate}
            onItemAdd={onItemAdd}
            onItemDelete={onItemDelete}
            onClaimAdded={onClaimAdded}
            onClaimSaved={onClaimSaved}
            onClaimDeleted={onClaimDeleted}
          />
        ) : expanded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProjectChecklist projectId={projectId} stageId={stage.id} track="technical" items={techItems} onItemUpdate={onItemUpdate} onItemAdd={onItemAdd} onItemDelete={onItemDelete} />
            <ProjectChecklist
              projectId={projectId}
              stageId={stage.id}
              track="financial"
              items={finItems}
              onItemUpdate={onItemUpdate}
              onItemAdd={onItemAdd}
              onItemDelete={onItemDelete}
              claims={stage.claims ?? []}
              onClaimAdded={onClaimAdded}
              onClaimSaved={onClaimSaved}
              onClaimDeleted={onClaimDeleted}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <div className="font-medium text-ink-soft">Техническая приёмка</div>
              <div className={`mt-0.5 ${techStatus.overdue ? 'font-medium text-overdue' : techStatus.planned ? 'text-ink-soft' : 'text-ink'}`}>{techStatus.text}</div>
            </div>
            <div>
              <div className="font-medium text-ink-soft">Финансовая приёмка</div>
              <div className={`mt-0.5 ${finStatus.overdue ? 'font-medium text-overdue' : finStatus.planned ? 'text-ink-soft' : 'text-ink'}`}>{finStatus.text}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function fieldList(entries: [string, string][]) {
  return entries.filter(([, v]) => v)
}

function LegalInfoCard({ project }: { project: Project }) {
  const fields = fieldList([
    ['Номер конкурсной заявки', project.competition_application_number],
    [
      'Протокол объявления отбора',
      project.protocol_announce_number ? `№ ${project.protocol_announce_number} от ${formatDate(project.protocol_announce_date)}` : '',
    ],
    ['Номер карточки в ЕГИСУ НИОКТР', project.egisu_number],
    ['КБК', project.kbk],
    ['Код по КБК', project.kbk_code],
    ['Код результата', project.result_code],
    ['ID в мега-таблице', project.external_project_id],
  ])

  if (!fields.length && !project.result_name) return null

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-ink">Юридическая информация</h3>
      <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <span className="text-ink-soft">{label}</span>
            <div className="mt-0.5 text-ink">{value}</div>
          </div>
        ))}
      </div>
      {project.result_name && <p className="mt-2 text-[11px] text-ink-soft">{project.result_name}</p>}
    </div>
  )
}

type PaymentEventDraft = { date: string; amount: string }

function eventsToDraft(payment: ProjectPayment): PaymentEventDraft[] {
  return payment.payment_events.length > 0
    ? payment.payment_events.map((e) => ({ date: e.date ?? '', amount: String(e.amount) }))
    : [{ date: '', amount: '' }]
}

function PaymentRow({
  projectId,
  payment,
  contracts,
  onSaved,
  onDeleted,
}: {
  projectId: string
  payment: ProjectPayment
  contracts: ProjectContract[]
  onSaved: (p: ProjectPayment) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [events, setEvents] = useState<PaymentEventDraft[]>(() => eventsToDraft(payment))
  const [saving, setSaving] = useState(false)
  const [editingContract, setEditingContract] = useState(false)
  const [contractNumber, setContractNumber] = useState(payment.contract_number)
  const [savingContract, setSavingContract] = useState(false)

  function startEdit() {
    setEvents(eventsToDraft(payment))
    setEditing(true)
  }

  function setEventField(i: number, field: 'date' | 'amount', value: string) {
    setEvents((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  }

  function startEditingContract() {
    setContractNumber(payment.contract_number)
    setEditingContract(true)
  }

  async function saveContract() {
    setSavingContract(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_number: contractNumber }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        setEditingContract(false)
      }
    } finally {
      setSavingContract(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_events: events
            .filter((e) => e.date || e.amount)
            .map((e) => ({ date: e.date || null, amount: e.amount ? Number(e.amount) : 0 })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Удалить платёж?')) return
    const res = await fetch(`/api/projects/${projectId}/payments/${payment.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(payment.id)
  }

  if (editing) {
    return (
      <tr className="border-t border-line">
        <td className="py-1.5 pr-6 align-top font-mono text-ink">{payment.plan_year || '—'}</td>
        <td className="py-1.5 pr-6 align-top font-mono text-ink-soft">{payment.contract_number || '—'}</td>
        <td className="py-1.5 pr-6 align-top text-ink">{formatRub(Number(payment.obligation_amount) || 0)}</td>
        <td className="py-1.5 pr-6" colSpan={2}>
          <div className="space-y-1">
            {events.map((ev, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="date"
                  value={ev.date}
                  onChange={(e) => setEventField(i, 'date', e.target.value)}
                  className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-xs text-ink-soft outline-none focus:border-teal"
                />
                <input
                  type="number"
                  placeholder="Сумма"
                  value={ev.amount}
                  onChange={(e) => setEventField(i, 'amount', e.target.value)}
                  className="w-28 rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs outline-none focus:border-teal"
                />
                {events.length > 1 && (
                  <button
                    onClick={() => setEvents((arr) => arr.filter((_, idx) => idx !== i))}
                    className="text-xs text-ink-soft hover:text-urgent"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setEvents((prev) => [...prev, { date: '', amount: '' }])}
                className="text-xs text-teal hover:opacity-80"
              >
                + платёж
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
              >
                {saving ? '…' : 'Сохранить'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
              >
                Отмена
              </button>
            </div>
          </div>
        </td>
        <td className="py-1.5 align-top">
          <button onClick={handleDelete} className="text-ink-soft transition hover:text-urgent">
            удалить
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-line">
      <td className="py-1 pr-6 font-mono text-ink">{payment.plan_year || '—'}</td>
      <td className="py-1 pr-6 font-mono text-ink-soft">
        {editingContract ? (
          <span className="flex items-center gap-1">
            <select
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs outline-none focus:border-teal"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.contract_number}>{c.contract_number}</option>
              ))}
              {!contracts.some((c) => c.contract_number === contractNumber) && (
                <option value={contractNumber}>{contractNumber || '—'}</option>
              )}
            </select>
            <button onClick={saveContract} disabled={savingContract} className="text-teal hover:opacity-80 disabled:opacity-50">
              {savingContract ? '…' : 'ОК'}
            </button>
            <button onClick={() => setEditingContract(false)} className="text-ink-soft hover:text-ink">×</button>
          </span>
        ) : (
          <button onClick={startEditingContract} className="transition hover:text-teal">
            {payment.contract_number || '—'}
          </button>
        )}
      </td>
      <td className="py-1 pr-6 text-ink">{formatRub(Number(payment.obligation_amount) || 0)}</td>
      <td className="py-1 pr-6">
        <button onClick={startEdit} className="text-ink transition hover:text-teal">
          {formatRub(Number(payment.paid_amount) || 0)}
        </button>
      </td>
      <td className="py-1 pr-6 text-ink-soft">
        {payment.payment_events.length === 0 && 'ожидается'}
        {payment.payment_events.length === 1 && `доведено ${formatDate(payment.payment_events[0].date)}`}
        {payment.payment_events.length > 1 && (
          <span title={payment.payment_events.map((e) => `${formatDate(e.date)} — ${formatRub(e.amount)}`).join('; ')}>
            доведено {payment.payment_events.length} платежами
          </span>
        )}
      </td>
      <td className="py-1">
        <button onClick={handleDelete} className="text-ink-soft transition hover:text-urgent">
          удалить
        </button>
      </td>
    </tr>
  )
}

function AddPaymentForm({
  projectId,
  contracts,
  onAdded,
}: {
  projectId: string
  contracts: ProjectContract[]
  onAdded: (p: ProjectPayment) => void
}) {
  const [adding, setAdding] = useState(false)
  const [contractNumber, setContractNumber] = useState(contracts[0]?.contract_number ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!contractNumber || !amount || !date) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_number: contractNumber, amount: Number(amount), date }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось добавить платёж')
        return
      }
      onAdded(data)
      setAmount('')
      setDate('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} className="mt-3 text-xs text-teal hover:opacity-80">
        + добавить платёж
      </button>
    )
  }

  return (
    <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs text-ink-soft">Договор</label>
        {contracts.length > 0 ? (
          <select
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            className="w-40 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.contract_number}>{c.contract_number}</option>
            ))}
          </select>
        ) : (
          <input
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            placeholder="Номер договора"
            className="w-36 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal"
          />
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-soft">Сумма платежа, ₽</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-soft">Дата платежа</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
      >
        {saving ? 'Добавляю…' : 'Добавить'}
      </button>
      <button
        type="button"
        onClick={() => setAdding(false)}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent"
      >
        Отмена
      </button>
      {error && <p className="w-full text-xs text-urgent">{error}</p>}
    </form>
  )
}

function FinancingCard({
  projectId,
  payments,
  contracts,
  onAdded,
  onSaved,
  onDeleted,
}: {
  projectId: string
  payments: ProjectPayment[]
  contracts: ProjectContract[]
  onAdded: (p: ProjectPayment) => void
  onSaved: (p: ProjectPayment) => void
  onDeleted: (id: string) => void
}) {
  const totalObligation = payments.reduce((a, p) => a + (Number(p.obligation_amount) || 0), 0)
  const totalPaid = payments.reduce((a, p) => a + (Number(p.paid_amount) || 0), 0)
  // Внутри одного года: сначала строки с фактом (доведено), пусто-факт — снизу — чтобы
  // не приходилось искать реальный платёж среди ещё не доведённых строк того же года.
  const sortedPayments = [...payments].sort((a, b) => {
    const yearDiff = (a.plan_year ?? 0) - (b.plan_year ?? 0)
    if (yearDiff !== 0) return yearDiff
    const aPaid = Number(a.paid_amount) > 0 ? 0 : 1
    const bPaid = Number(b.paid_amount) > 0 ? 0 : 1
    return aPaid - bPaid
  })

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-ink">Финансирование</h3>
      {payments.length === 0 ? (
        <p className="mt-2 text-xs text-ink-soft">Платежей пока нет.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-soft">
                <th className="pb-1 pr-6 font-medium">Год</th>
                <th className="pb-1 pr-6 font-medium">Договор</th>
                <th className="pb-1 pr-6 font-medium">План</th>
                <th className="pb-1 pr-6 font-medium">Факт</th>
                <th className="pb-1 pr-6 font-medium">Статус</th>
                <th className="pb-1 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((p) => (
                <PaymentRow key={p.id} projectId={projectId} payment={p} contracts={contracts} onSaved={onSaved} onDeleted={onDeleted} />
              ))}
              <tr className="border-t border-line font-semibold text-ink">
                <td className="py-1 pr-6" colSpan={2}>Итого</td>
                <td className="py-1 pr-6">{formatRub(totalObligation)}</td>
                <td className="py-1 pr-6">{formatRub(totalPaid)}</td>
                <td className="py-1" colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <AddPaymentForm projectId={projectId} contracts={contracts} onAdded={onAdded} />
    </div>
  )
}

function ContactsCard({ project }: { project: Project }) {
  const fields = fieldList([
    ['Email организации', project.org_email],
    ['Email получателя (из договора)', project.grantee_email_from_contract],
  ])

  if (!fields.length) return null

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-ink">Контакты</h3>
      <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <span className="text-ink-soft">{label}</span>
            <div className="mt-0.5 text-ink">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GrbsCard({ contracts }: { contracts: ProjectContract[] }) {
  const rows = [...contracts]
    .filter((c) => c.subsidy_agreement_number || c.subsidy_decision_number || c.subsidy_identifier)
    .sort((a, b) => (a.contract_year ?? 0) - (b.contract_year ?? 0))

  if (!rows.length) return null

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-ink">Информация о ГРБС</h3>
      <div className="mt-2 space-y-2 text-xs">
        {rows.map((c) => (
          <div key={c.id}>
            <span className="font-medium text-ink">
              {c.contract_year} ({c.subsidy_ministry || '—'}):
            </span>{' '}
            <span className="text-ink-soft">
              {c.subsidy_agreement_number && `соглашение № ${c.subsidy_agreement_number} от ${formatDate(c.subsidy_agreement_date)}`}
              {c.subsidy_agreement_number && (c.subsidy_decision_number || c.subsidy_identifier) && ', '}
              {c.subsidy_decision_number && `решение № ${c.subsidy_decision_number} от ${formatDate(c.subsidy_decision_date)}`}
              {c.subsidy_decision_number && c.subsidy_identifier && ', '}
              {c.subsidy_identifier && `идентификатор субсидии ${c.subsidy_identifier}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DataNotesCard({ project }: { project: Project }) {
  const fields = fieldList([
    ['Качество данных', project.data_quality_comment],
    ['Комментарий пользователя', project.user_comment],
    ['Востребованность', project.demand_comment],
    ['Финэкспертиза', project.financial_expertise_comment],
    ['Состояние исполнителя', project.executor_state],
  ])

  if (!fields.length) return null

  return (
    <div>
      <h3 className="font-display text-base font-semibold text-ink">Комментарии по данным</h3>
      <div className="mt-2 space-y-1.5 text-xs">
        {fields.map(([label, value]) => (
          <div key={label}>
            <span className="text-ink-soft">{label}:</span> <span className="text-ink">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SystemInfoSection({
  project,
  contracts,
  stages,
  payments,
  onContractAdded,
  onContractSaved,
  onPaymentAdded,
  onPaymentSaved,
  onPaymentDeleted,
  onClaimAdded,
  onClaimSaved,
  onClaimDeleted,
}: {
  project: Project
  contracts: ProjectContract[]
  stages: ProjectStage[]
  payments: ProjectPayment[]
  onContractAdded: (c: ProjectContract) => void
  onContractSaved: (c: ProjectContract) => void
  onPaymentAdded: (p: ProjectPayment) => void
  onPaymentSaved: (p: ProjectPayment) => void
  onPaymentDeleted: (id: string) => void
  onClaimAdded: (stageId: string, c: ProjectClaim) => void
  onClaimSaved: (stageId: string, c: ProjectClaim) => void
  onClaimDeleted: (stageId: string, id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const projectId = project.id

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-center justify-between text-left">
        <h2 className="font-display text-base font-semibold text-ink">Дополнительная информация</h2>
        <span className="text-xs text-ink-soft">{expanded ? 'Свернуть' : 'Развернуть'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-3">
          <ContractsCard
            projectId={projectId}
            contracts={contracts}
            stageNumbers={stages.map((s) => s.stage_number)}
            onAdded={onContractAdded}
            onSaved={onContractSaved}
            bare
          />
          <LegalInfoCard project={project} />
          <GrbsCard contracts={contracts} />
          <FinancingCard
            projectId={projectId}
            payments={payments}
            contracts={contracts}
            onAdded={onPaymentAdded}
            onSaved={onPaymentSaved}
            onDeleted={onPaymentDeleted}
          />
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Требования о возврате</h3>
            <div className="mt-2 space-y-2">
              {stages.map((stage) => (
                <StageClaimsList
                  key={stage.id}
                  projectId={projectId}
                  stageId={stage.id}
                  stageNumber={stage.stage_number}
                  claims={stage.claims ?? []}
                  onAdded={(c) => onClaimAdded(stage.id, c)}
                  onSaved={(c) => onClaimSaved(stage.id, c)}
                  onDeleted={(id) => onClaimDeleted(stage.id, id)}
                />
              ))}
            </div>
          </div>
          <ContactsCard project={project} />
          <DataNotesCard project={project} />
        </div>
      )}
    </div>
  )
}

function AddStageForm({ projectId, onAdded }: { projectId: string; onAdded: (stage: ProjectStage) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate || null, end_date: endDate || null, cost: cost ? Number(cost) : null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось создать этап')
        return
      }
      onAdded(data.stage)
      setExpanded(false)
      setStartDate('')
      setEndDate('')
      setCost('')
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-soft transition hover:border-teal hover:text-teal"
      >
        <span className="text-base font-semibold text-teal">+</span> Добавить этап
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-4">
      <div>
        <label className="mb-1 block text-xs text-ink-soft">Начало</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-soft">Окончание</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-soft">Сумма, ₽</label>
        <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-32 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
      </div>
      <button type="submit" disabled={saving} className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
        {saving ? 'Создаю…' : 'Создать этап'}
      </button>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-urgent hover:text-urgent"
      >
        Отмена
      </button>
      {error && <p className="w-full text-xs text-urgent">{error}</p>}
    </form>
  )
}

function ProjectTasksSection({
  projectId,
  currentEmployee,
  employees,
  initialTasks,
}: {
  projectId: string
  currentEmployee: Employee
  employees: Employee[]
  initialTasks: Task[]
}) {
  const [tasks, setTasks] = useState(initialTasks)

  async function refresh() {
    const res = await fetch(`/api/projects/${projectId}/tasks`)
    if (res.ok) setTasks(await res.json())
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Задачи</h2>
      <div className="mt-3 space-y-3">
        <TaskForm employees={employees} defaultProjectId={projectId} onCreated={refresh} />
        {tasks.length === 0 && <p className="text-sm text-ink-soft">Задач по проекту пока нет.</p>}
        {tasks.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee.id} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProjectDetail({
  project: initialProject,
  currentEmployee,
  employees,
  initialTasks,
}: {
  project: Project
  currentEmployee: Employee
  employees: Employee[]
  initialTasks: Task[]
}) {
  const [project, setProject] = useState(initialProject)
  const [contracts, setContracts] = useState(initialProject.contracts ?? [])
  const [payments, setPayments] = useState(initialProject.payments ?? [])
  const [stages, setStages] = useState(() => [...(initialProject.stages ?? [])].sort((a, b) => a.stage_number - b.stage_number))

  function updateStage(stageId: string, patch: Partial<ProjectStage>) {
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, ...patch } : s)))
    fetch(`/api/projects/${project.id}/stages/${stageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  async function deleteStage(stageId: string) {
    if (!confirm('Удалить этап вместе с чек-листом? Это необратимо.')) return
    const res = await fetch(`/api/projects/${project.id}/stages/${stageId}`, { method: 'DELETE' })
    if (res.ok) setStages((prev) => prev.filter((s) => s.id !== stageId))
  }

  function handleItemUpdate(stageId: string, updated: ProjectChecklistItem) {
    setStages((prev) =>
      prev.map((s) =>
        s.id !== stageId ? s : { ...s, checklist_items: (s.checklist_items ?? []).map((i) => (i.id === updated.id ? updated : i)) }
      )
    )
  }

  function handleItemAdd(stageId: string, item: ProjectChecklistItem) {
    setStages((prev) => prev.map((s) => (s.id !== stageId ? s : { ...s, checklist_items: [...(s.checklist_items ?? []), item] })))
  }

  function handleItemDelete(stageId: string, itemId: string) {
    setStages((prev) =>
      prev.map((s) => (s.id !== stageId ? s : { ...s, checklist_items: (s.checklist_items ?? []).filter((i) => i.id !== itemId) }))
    )
  }

  function handleClaimAdded(stageId: string, claim: ProjectClaim) {
    setStages((prev) => prev.map((s) => (s.id !== stageId ? s : { ...s, claims: [...(s.claims ?? []), claim] })))
  }

  function handleClaimSaved(stageId: string, claim: ProjectClaim) {
    setStages((prev) =>
      prev.map((s) => (s.id !== stageId ? s : { ...s, claims: (s.claims ?? []).map((c) => (c.id === claim.id ? claim : c)) }))
    )
  }

  function handleClaimDeleted(stageId: string, claimId: string) {
    setStages((prev) => prev.map((s) => (s.id !== stageId ? s : { ...s, claims: (s.claims ?? []).filter((c) => c.id !== claimId) })))
  }

  // Этапы после первого незакрытого — «неактивны» (видны, но без чек-листа), пока не закроется предыдущий.
  const firstActiveIndex = stages.findIndex((s) => !isStageClosed(s.checklist_items ?? []))

  return (
    <div className="space-y-4">
      <ProjectHeader project={project} isOwner={currentEmployee.is_owner} onSaved={(patch) => setProject((p) => ({ ...p, ...patch }))} />

      <section>
        <h2 className="mb-2 font-display text-base font-semibold text-ink">Этапы</h2>
        <div className="space-y-3">
          {stages.map((stage, i) => (
            <StageCard
              key={stage.id}
              projectId={project.id}
              stage={stage}
              locked={firstActiveIndex !== -1 && i > firstActiveIndex}
              onStageSave={(patch) => updateStage(stage.id, patch)}
              onStageDelete={() => deleteStage(stage.id)}
              onItemUpdate={(item) => handleItemUpdate(stage.id, item)}
              onItemAdd={(item) => handleItemAdd(stage.id, item)}
              onItemDelete={(itemId) => handleItemDelete(stage.id, itemId)}
              onClaimAdded={(c) => handleClaimAdded(stage.id, c)}
              onClaimSaved={(c) => handleClaimSaved(stage.id, c)}
              onClaimDeleted={(id) => handleClaimDeleted(stage.id, id)}
            />
          ))}
          <AddStageForm projectId={project.id} onAdded={(stage) => setStages((prev) => [...prev, stage])} />
        </div>
      </section>

      <ProjectTasksSection projectId={project.id} currentEmployee={currentEmployee} employees={employees} initialTasks={initialTasks} />

      <SystemInfoSection
        project={project}
        contracts={contracts}
        stages={stages}
        payments={payments}
        onContractAdded={(c) => setContracts((prev) => [...prev, c])}
        onContractSaved={(c) => setContracts((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
        onPaymentAdded={(p) => setPayments((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p]))}
        onPaymentSaved={(p) => setPayments((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
        onPaymentDeleted={(id) => setPayments((prev) => prev.filter((x) => x.id !== id))}
        onClaimAdded={handleClaimAdded}
        onClaimSaved={handleClaimSaved}
        onClaimDeleted={handleClaimDeleted}
      />

      <div className="rounded-2xl border border-line bg-white p-5">
        <ProjectComments projectId={project.id} initialComments={initialProject.comments ?? []} currentEmployee={currentEmployee} />
      </div>
    </div>
  )
}

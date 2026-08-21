'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChecklistTrack, Employee, Project, ProjectChecklistItem, ProjectContract, ProjectStage } from '@/types'
import { isStageClosed } from '@/lib/project-checklist-templates'
import ProjectChecklist from '@/components/ProjectChecklist'
import ProjectComments from '@/components/ProjectComments'

function formatRub(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽'
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : '—'
}

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Действующий',
  terminated: 'Прекращён',
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
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${
                  project.status === 'terminated' ? 'bg-urgent-soft text-urgent' : 'bg-teal-soft text-teal'
                }`}
              >
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

  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-ink-soft">
        {contract.contract_number} от {formatDate(contract.contract_date)}{' '}
        {contract.stage_number ? `(этап ${contract.stage_number})` : contract.contract_year ? `(${contract.contract_year})` : ''}
      </span>
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
          <button onClick={() => setEditing(false)} className="text-xs text-ink-soft hover:text-ink">Отмена</button>
        </>
      ) : contract.akr ? (
        <button onClick={startEditing} className="font-mono text-xs text-ink-soft transition hover:text-teal">
          АКР: {contract.akr}
        </button>
      ) : (
        <button onClick={startEditing} className="text-xs text-teal hover:opacity-80">+ добавить АКР</button>
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
          {contracts.map((c) => (
            <ContractRow key={c.id} projectId={projectId} contract={c} onSaved={onSaved} />
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Номер договора" className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal" />
          <select
            value={stageNumber}
            onChange={(e) => setStageNumber(e.target.value)}
            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal"
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
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-ink-soft hover:text-ink">Отмена</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 text-xs text-teal hover:opacity-80">+ добавить договор</button>
      )}
    </div>
  )
}

function lastCompletedStep(items: ProjectChecklistItem[], track: ChecklistTrack) {
  return [...items]
    .filter((i) => i.track === track && i.done)
    .sort((a, b) => b.step_order - a.step_order)[0] ?? null
}

function nextPendingStep(items: ProjectChecklistItem[], track: ChecklistTrack) {
  return [...items]
    .filter((i) => i.track === track && !i.done)
    .sort((a, b) => a.step_order - b.step_order)[0] ?? null
}

function ClosedStageSummary({
  projectId,
  stage,
  onItemUpdate,
  onItemAdd,
  onItemDelete,
}: {
  projectId: string
  stage: ProjectStage
  onItemUpdate: (item: ProjectChecklistItem) => void
  onItemAdd: (item: ProjectChecklistItem) => void
  onItemDelete: (itemId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const items = stage.checklist_items ?? []
  const techLast = lastCompletedStep(items, 'technical')
  const finLast = lastCompletedStep(items, 'financial')
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
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-ink-soft">Техническая приёмка</div>
          <div className="mt-0.5 text-sm text-done">
            {techLast ? `${techLast.title}${techLast.target_date ? ' · ' + formatDate(techLast.target_date) : ''}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-soft">Финансовая приёмка</div>
          <div className="mt-0.5 text-sm text-done">
            {finLast ? `${finLast.title}${finLast.target_date ? ' · ' + formatDate(finLast.target_date) : ''}` : '—'}
          </div>
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
}: {
  projectId: string
  stage: ProjectStage
  locked: boolean
  onStageSave: (patch: Partial<ProjectStage>) => void
  onStageDelete: () => void
  onItemUpdate: (item: ProjectChecklistItem) => void
  onItemAdd: (item: ProjectChecklistItem) => void
  onItemDelete: (itemId: string) => void
}) {
  const closed = isStageClosed(stage.checklist_items ?? [])
  const [editingDates, setEditingDates] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [startDate, setStartDate] = useState(stage.start_date ?? '')
  const [endDate, setEndDate] = useState(stage.end_date ?? '')
  const [cost, setCost] = useState(stage.cost?.toString() ?? '')

  const techItems = (stage.checklist_items ?? []).filter((i) => i.track === 'technical')
  const finItems = (stage.checklist_items ?? []).filter((i) => i.track === 'financial')
  const techNext = nextPendingStep(stage.checklist_items ?? [], 'technical')
  const finNext = nextPendingStep(stage.checklist_items ?? [], 'financial')

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
          <button onClick={() => setEditingDates(false)} className="text-xs text-ink-soft hover:text-ink">Отмена</button>
        </div>
      ) : (
        !closed && (
          <p className="mt-1 font-mono text-xs text-ink-soft">{formatDate(stage.start_date)} – {formatDate(stage.end_date)} · {formatRub(stage.cost)}</p>
        )
      )}

      <div className="mt-4">
        {closed ? (
          <ClosedStageSummary projectId={projectId} stage={stage} onItemUpdate={onItemUpdate} onItemAdd={onItemAdd} onItemDelete={onItemDelete} />
        ) : expanded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProjectChecklist projectId={projectId} stageId={stage.id} track="technical" items={techItems} onItemUpdate={onItemUpdate} onItemAdd={onItemAdd} onItemDelete={onItemDelete} />
            <ProjectChecklist projectId={projectId} stageId={stage.id} track="financial" items={finItems} onItemUpdate={onItemUpdate} onItemAdd={onItemAdd} onItemDelete={onItemDelete} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <div className="font-medium text-ink-soft">Техническая приёмка</div>
              <div className="mt-0.5 text-ink">{techNext ? techNext.title : 'Все шаги выполнены'}</div>
            </div>
            <div>
              <div className="font-medium text-ink-soft">Финансовая приёмка</div>
              <div className="mt-0.5 text-ink">{finNext ? finNext.title : 'Все шаги выполнены'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SystemInfoSection({
  projectId,
  contracts,
  stageNumbers,
  onContractAdded,
  onContractSaved,
}: {
  projectId: string
  contracts: ProjectContract[]
  stageNumbers: number[]
  onContractAdded: (c: ProjectContract) => void
  onContractSaved: (c: ProjectContract) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-center justify-between text-left">
        <h2 className="font-display text-base font-semibold text-ink">Системная информация</h2>
        <span className="text-xs text-ink-soft">{expanded ? 'Свернуть' : 'Развернуть'}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-4">
          <ContractsCard
            projectId={projectId}
            contracts={contracts}
            stageNumbers={stageNumbers}
            onAdded={onContractAdded}
            onSaved={onContractSaved}
            bare
          />
          <p className="text-sm text-ink-soft">Другие поля появятся позже.</p>
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
      <button type="button" onClick={() => setExpanded(false)} className="text-sm text-ink-soft hover:text-ink">Отмена</button>
      {error && <p className="w-full text-xs text-urgent">{error}</p>}
    </form>
  )
}

export default function ProjectDetail({
  project: initialProject,
  currentEmployee,
}: {
  project: Project
  currentEmployee: Employee
}) {
  const [project, setProject] = useState(initialProject)
  const [contracts, setContracts] = useState(initialProject.contracts ?? [])
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

  // Этапы после первого незакрытого — «неактивны» (видны, но без чек-листа), пока не закроется предыдущий.
  const firstActiveIndex = stages.findIndex((s) => !isStageClosed(s.checklist_items ?? []))

  return (
    <div className="space-y-6">
      <ProjectHeader project={project} isOwner={currentEmployee.is_owner} onSaved={(patch) => setProject((p) => ({ ...p, ...patch }))} />

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Этапы</h2>
        <div className="space-y-4">
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
            />
          ))}
          <AddStageForm projectId={project.id} onAdded={(stage) => setStages((prev) => [...prev, stage])} />
        </div>
      </section>

      <SystemInfoSection
        projectId={project.id}
        contracts={contracts}
        stageNumbers={stages.map((s) => s.stage_number)}
        onContractAdded={(c) => setContracts((prev) => [...prev, c])}
        onContractSaved={(c) => setContracts((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
      />

      <div className="rounded-2xl border border-line bg-white p-5">
        <ProjectComments projectId={project.id} initialComments={initialProject.comments ?? []} currentEmployee={currentEmployee} />
      </div>
    </div>
  )
}

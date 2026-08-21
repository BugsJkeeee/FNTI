'use client'

import { useState } from 'react'
import type { ProjectClaim } from '@/types'

function formatRub(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽'
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : '—'
}

type ClaimFieldKey =
  | 'claim_date'
  | 'claim_number'
  | 'claim_balance'
  | 'claim_misuse_amount'
  | 'claim_noncompliance_amount'
  | 'claim_execution_date'

const CLAIM_FIELD_META: Record<ClaimFieldKey, { label: string; type: string }> = {
  claim_date: { label: 'Дата требования', type: 'date' },
  claim_number: { label: 'Номер требования', type: 'text' },
  claim_balance: { label: 'Остаток, руб.', type: 'number' },
  claim_misuse_amount: { label: 'Нецелевой расход, руб.', type: 'number' },
  claim_noncompliance_amount: { label: 'Несоответствие требованиям договора, руб.', type: 'number' },
  claim_execution_date: { label: 'Дата исполнения требования', type: 'date' },
}

const SUM_FIELD_KEYS: ClaimFieldKey[] = ['claim_balance', 'claim_misuse_amount', 'claim_noncompliance_amount']
export const SEND_CLAIM_FIELDS: ClaimFieldKey[] = ['claim_date', 'claim_number', 'claim_balance', 'claim_misuse_amount', 'claim_noncompliance_amount']
export const EXECUTION_CLAIM_FIELDS: ClaimFieldKey[] = ['claim_execution_date']
const DISPLAY_HEAD_KEYS: ClaimFieldKey[] = ['claim_date', 'claim_number']
const DISPLAY_TAIL_KEYS: ClaimFieldKey[] = ['claim_balance', 'claim_misuse_amount', 'claim_noncompliance_amount', 'claim_execution_date']

// Только цифры и одна десятичная точка — отрицательные суммы по требованию о возврате не бывают.
function sanitizeNumberInput(raw: string) {
  return raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
}

function emptyValues(keys: ClaimFieldKey[]) {
  return Object.fromEntries(keys.map((k) => [k, ''])) as Record<string, string>
}

function valuesFromClaim(claim: ProjectClaim, keys: ClaimFieldKey[]) {
  return Object.fromEntries(keys.map((k) => [k, (claim[k] ?? '').toString()])) as Record<string, string>
}

function toPatch(values: Record<string, string>, keys: ClaimFieldKey[]) {
  const patch: Record<string, string | number | null> = {}
  for (const key of keys) {
    const type = CLAIM_FIELD_META[key].type
    if (type === 'text') patch[key] = values[key] ?? ''
    else if (type === 'number') patch[key] = values[key] ? Number(values[key]) : null
    else patch[key] = values[key] || null
  }
  return patch
}

function sumOf(values: Record<string, string>) {
  const total = SUM_FIELD_KEYS.reduce((acc, key) => acc + (values[key] ? Number(values[key]) : 0), 0)
  return total > 0 ? total : null
}

async function createClaim(projectId: string, stageId: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) return null
  return res.json()
}

async function updateClaim(projectId: string, stageId: string, claimId: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/claims/${claimId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) return null
  return res.json()
}

async function deleteClaim(projectId: string, stageId: string, claimId: string) {
  const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/claims/${claimId}`, { method: 'DELETE' })
  return res.ok
}

/**
 * Компактная строка полей одного требования — в духе поля «Комментарий» у пункта чек-листа,
 * без рамки/заголовка. Используется инлайн под пунктами «Направлено»/«Исполнено требование о
 * возврате». Сохранение по явному «OK» (не по blur — суммы лучше не терять от случайного клика).
 */
function CompactClaimRow({
  projectId,
  stageId,
  claim,
  fieldKeys,
  onSaved,
  onDeleted,
  onCancelNew,
}: {
  projectId: string
  stageId: string
  claim: ProjectClaim | null
  fieldKeys: ClaimFieldKey[]
  onSaved: (c: ProjectClaim) => void
  onDeleted?: () => void
  onCancelNew?: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => (claim ? valuesFromClaim(claim, fieldKeys) : emptyValues(fieldKeys)))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  function setField(key: ClaimFieldKey, value: string) {
    const clean = CLAIM_FIELD_META[key].type === 'number' ? sanitizeNumberInput(value) : value
    setValues((v) => ({ ...v, [key]: clean }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const patch = toPatch(values, fieldKeys)
      const data = claim ? await updateClaim(projectId, stageId, claim.id, patch) : await createClaim(projectId, stageId, patch)
      if (data) {
        onSaved(data)
        setDirty(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {fieldKeys.map((key) => {
        const meta = CLAIM_FIELD_META[key]
        return (
          <input
            key={key}
            type={meta.type}
            min={meta.type === 'number' ? 0 : undefined}
            placeholder={meta.label}
            value={values[key] ?? ''}
            onChange={(e) => setField(key, e.target.value)}
            className={`rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs text-ink-soft outline-none focus:border-teal ${
              meta.type === 'date' ? 'font-mono' : meta.type === 'number' ? 'no-spinner w-28' : 'w-36'
            }`}
          />
        )
      })}
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
        >
          {saving ? '…' : 'OK'}
        </button>
      )}
      {onCancelNew && !claim && (
        <button onClick={onCancelNew} className="text-xs text-ink-soft hover:text-ink">Отмена</button>
      )}
      {onDeleted && claim && (
        <button onClick={onDeleted} className="text-xs text-ink-soft transition hover:text-urgent">удалить</button>
      )}
    </div>
  )
}

/**
 * Список требований по этапу в компактном виде — под конкретным пунктом чек-листа.
 * allowAdd — можно ли добавить новое требование отсюда (да под «Направлено», нет под «Исполнено»,
 * там просто проставляют дату исполнения уже существующим требованиям).
 */
export function ClaimsListInline({
  projectId,
  stageId,
  claims,
  fieldKeys,
  allowAdd,
  onAdded,
  onSaved,
  onDeleted,
}: {
  projectId: string
  stageId: string
  claims: ProjectClaim[]
  fieldKeys: ClaimFieldKey[]
  allowAdd: boolean
  onAdded: (c: ProjectClaim) => void
  onSaved: (c: ProjectClaim) => void
  onDeleted: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="mt-0.5 space-y-1">
      {claims.length === 0 && !adding && (
        <p className="text-xs text-ink-soft">{allowAdd ? 'Требований пока нет.' : 'Нет требований для исполнения.'}</p>
      )}
      {claims.map((c) => (
        <CompactClaimRow
          key={c.id}
          projectId={projectId}
          stageId={stageId}
          claim={c}
          fieldKeys={fieldKeys}
          onSaved={onSaved}
          onDeleted={allowAdd ? () => deleteClaim(projectId, stageId, c.id).then((ok) => ok && onDeleted(c.id)) : undefined}
        />
      ))}
      {adding && (
        <CompactClaimRow
          projectId={projectId}
          stageId={stageId}
          claim={null}
          fieldKeys={fieldKeys}
          onSaved={(c) => {
            onAdded(c)
            setAdding(false)
          }}
          onCancelNew={() => setAdding(false)}
        />
      )}
      {allowAdd && !adding && (
        <button onClick={() => setAdding(true)} className="text-xs text-teal hover:opacity-80">
          + добавить требование
        </button>
      )}
    </div>
  )
}

/**
 * Одна карточка требования в «Системной информации» — все поля, с подписями и вычисляемой
 * суммой. Тот же project_claims, что и у ClaimsListInline в чек-листе — просто ещё одно место,
 * где видно и можно поправить те же данные.
 */
function ClaimCard({
  projectId,
  stageId,
  claim,
  onSaved,
  onDeleted,
  onCancelNew,
}: {
  projectId: string
  stageId: string
  claim: ProjectClaim | null
  onSaved: (c: ProjectClaim) => void
  onDeleted?: () => void
  onCancelNew?: () => void
}) {
  const allKeys = [...DISPLAY_HEAD_KEYS, ...DISPLAY_TAIL_KEYS]
  const [editing, setEditing] = useState(!claim)
  const [values, setValues] = useState<Record<string, string>>(() => (claim ? valuesFromClaim(claim, allKeys) : emptyValues(allKeys)))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function startEditing() {
    if (claim) setValues(valuesFromClaim(claim, allKeys))
    setEditing(true)
  }

  function setValue(key: ClaimFieldKey, value: string) {
    const clean = CLAIM_FIELD_META[key].type === 'number' ? sanitizeNumberInput(value) : value
    setValues((v) => ({ ...v, [key]: clean }))
  }

  async function save() {
    setSaving(true)
    try {
      const patch = toPatch(values, allKeys)
      const data = claim ? await updateClaim(projectId, stageId, claim.id, patch) : await createClaim(projectId, stageId, patch)
      if (data) {
        onSaved(data)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!claim || !onDeleted) return
    setDeleting(true)
    try {
      if (await deleteClaim(projectId, stageId, claim.id)) onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  if (!editing && claim) {
    return (
      <div className="rounded-lg border border-line p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-xs text-ink-soft sm:grid-cols-3">
            <div>Дата требования: {formatDate(claim.claim_date)}</div>
            <div>№ {claim.claim_number || '—'}</div>
            <div className="font-medium text-ink">Сумма требования: {formatRub(sumOf(valuesFromClaim(claim, SUM_FIELD_KEYS)))}</div>
            <div>Остаток: {formatRub(claim.claim_balance)}</div>
            <div>Нецелевой расход: {formatRub(claim.claim_misuse_amount)}</div>
            <div>Несоответствие требованиям договора: {formatRub(claim.claim_noncompliance_amount)}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={startEditing} className="text-xs text-teal hover:opacity-80">Изменить</button>
            <button onClick={remove} disabled={deleting} className="text-xs text-ink-soft transition hover:text-urgent disabled:opacity-50">
              удалить
            </button>
          </div>
        </div>
        <div className="mt-2 border-t border-line pt-1.5 text-xs text-ink-soft">
          Дата исполнения: {formatDate(claim.claim_execution_date)}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DISPLAY_HEAD_KEYS.map((key) => (
          <div key={key}>
            <label className="mb-1 block h-8 text-xs leading-tight text-ink-soft">{CLAIM_FIELD_META[key].label}</label>
            <input
              type={CLAIM_FIELD_META[key].type}
              value={values[key] ?? ''}
              onChange={(e) => setValue(key, e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-teal"
            />
          </div>
        ))}
        <div>
          <label className="mb-1 block h-8 text-xs leading-tight text-ink-soft">Сумма требования, руб.</label>
          <p className="px-2 py-1 text-xs text-ink-soft">{formatRub(sumOf(values))}</p>
        </div>
        {DISPLAY_TAIL_KEYS.map((key) => (
          <div key={key}>
            <label className="mb-1 block h-8 text-xs leading-tight text-ink-soft">{CLAIM_FIELD_META[key].label}</label>
            <input
              type={CLAIM_FIELD_META[key].type}
              min={CLAIM_FIELD_META[key].type === 'number' ? 0 : undefined}
              value={values[key] ?? ''}
              onChange={(e) => setValue(key, e.target.value)}
              className={`w-full rounded-md border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-teal ${
                CLAIM_FIELD_META[key].type === 'number' ? 'no-spinner' : ''
              }`}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 sm:col-span-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
          <button
            onClick={() => (claim ? setEditing(false) : onCancelNew?.())}
            className="text-xs text-ink-soft hover:text-ink"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Сводный список требований о возврате по этапу — используется в «Системной информации».
 */
export default function StageClaimsList({
  projectId,
  stageId,
  stageNumber,
  claims,
  onAdded,
  onSaved,
  onDeleted,
}: {
  projectId: string
  stageId: string
  stageNumber: number
  claims: ProjectClaim[]
  onAdded: (c: ProjectClaim) => void
  onSaved: (c: ProjectClaim) => void
  onDeleted: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="rounded-lg border border-line bg-paper/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-ink">Этап {stageNumber} — требования о возврате</h4>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-xs text-teal hover:opacity-80">+ добавить требование</button>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {claims.length === 0 && !adding && <p className="text-xs text-ink-soft">Требований не выставлялось.</p>}
        {claims.map((c) => (
          <ClaimCard
            key={c.id}
            projectId={projectId}
            stageId={stageId}
            claim={c}
            onSaved={onSaved}
            onDeleted={() => onDeleted(c.id)}
          />
        ))}
        {adding && (
          <ClaimCard
            projectId={projectId}
            stageId={stageId}
            claim={null}
            onSaved={(c) => {
              onAdded(c)
              setAdding(false)
            }}
            onCancelNew={() => setAdding(false)}
          />
        )}
      </div>
    </div>
  )
}

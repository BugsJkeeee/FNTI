'use client'

import { useState } from 'react'
import type { ChecklistTrack, ProjectChecklistItem } from '@/types'

const TRACK_LABEL: Record<ChecklistTrack, string> = {
  technical: 'Техническая приёмка',
  financial: 'Финансовая приёмка',
}

function ChecklistRow({
  item,
  onToggle,
  onFieldSave,
  onDelete,
}: {
  item: ProjectChecklistItem
  onToggle: () => void
  onFieldSave: (patch: { target_date?: string; comment?: string }) => void
  onDelete: () => void
}) {
  const [comment, setComment] = useState(item.comment)
  const [targetDate, setTargetDate] = useState(item.target_date ?? '')

  return (
    <div className={`rounded-lg px-1.5 py-1 transition ${item.done ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-1.5">
        <input type="checkbox" checked={item.done} onChange={onToggle} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight text-ink">{item.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              onBlur={() => targetDate !== (item.target_date ?? '') && onFieldSave({ target_date: targetDate })}
              className="rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-xs text-ink-soft outline-none focus:border-teal"
            />
            {!item.is_default && (
              <button onClick={onDelete} className="text-xs text-ink-soft transition hover:text-urgent">
                удалить
              </button>
            )}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => comment !== item.comment && onFieldSave({ comment })}
            placeholder="Комментарий…"
            rows={1}
            className="mt-0.5 w-full rounded-md border border-line bg-paper px-1.5 py-0.5 text-xs text-ink outline-none focus:border-teal"
          />
        </div>
      </div>
    </div>
  )
}

export default function ProjectChecklist({
  projectId,
  stageId,
  track,
  items,
  onItemUpdate,
  onItemAdd,
  onItemDelete,
  hideAddForm,
  emptyLabel,
}: {
  projectId: string
  stageId: string
  track: ChecklistTrack
  items: ProjectChecklistItem[]
  onItemUpdate: (item: ProjectChecklistItem) => void
  onItemAdd: (item: ProjectChecklistItem) => void
  onItemDelete: (itemId: string) => void
  hideAddForm?: boolean
  emptyLabel?: string
}) {
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...items].sort((a, b) => a.step_order - b.step_order)

  async function handleToggle(item: ProjectChecklistItem) {
    setError(null)
    const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !item.done }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Не удалось обновить шаг')
      return
    }
    onItemUpdate(data)
  }

  async function handleFieldSave(item: ProjectChecklistItem, patch: { target_date?: string; comment?: string }) {
    setError(null)
    const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Не удалось сохранить')
      return
    }
    onItemUpdate(data)
  }

  async function handleDelete(item: ProjectChecklistItem) {
    setError(null)
    const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist/${item.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Не удалось удалить пункт')
      return
    }
    onItemDelete(item.id)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/stages/${stageId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track, title: newTitle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось добавить пункт')
        return
      }
      onItemAdd(data)
      setNewTitle('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{TRACK_LABEL[track]}</h3>
      <div className="space-y-0.5">
        {sorted.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            onToggle={() => handleToggle(item)}
            onFieldSave={(patch) => handleFieldSave(item, patch)}
            onDelete={() => handleDelete(item)}
          />
        ))}
        {sorted.length === 0 && emptyLabel && <p className="text-xs text-ink-soft">{emptyLabel}</p>}
      </div>

      {!hideAddForm && (
        <form onSubmit={handleAdd} className="mt-2 flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Добавить свой пункт…"
            className="flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-teal"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || adding}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
          >
            {adding ? 'Добавляю…' : 'Добавить'}
          </button>
        </form>
      )}

      {error && <p className="mt-1.5 text-xs text-urgent">{error}</p>}
    </div>
  )
}

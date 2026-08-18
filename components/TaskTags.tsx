'use client'

import { useState } from 'react'
import type { Tag } from '@/types'

export default function TaskTags({
  taskId,
  initialTags,
  availableTags,
}: {
  taskId: string
  initialTags: Tag[]
  availableTags: Tag[]
}) {
  const [tags, setTags] = useState(initialTags)
  const [selectedId, setSelectedId] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = availableTags.filter((t) => !tags.some((x) => x.id === t.id))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось добавить тег')
        return
      }
      setTags((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data]))
      setSelectedId('')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(tagId: string) {
    setError(null)
    const res = await fetch(`/api/tasks/${taskId}/tags/${tagId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Не удалось убрать тег')
      return
    }
    setTags((prev) => prev.filter((t) => t.id !== tagId))
  }

  return (
    <div className="mt-4">
      <p className="mb-1.5 font-mono text-xs text-ink-soft">Теги</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className="flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink"
          >
            {t.name}
            <button onClick={() => handleRemove(t.id)} className="text-ink-soft transition hover:text-urgent">
              ×
            </button>
          </span>
        ))}
      </div>

      {options.length > 0 && (
        <form onSubmit={handleAdd} className="mt-2 flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-teal"
          >
            <option value="">+ добавить тег</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selectedId || adding}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-teal hover:text-teal disabled:opacity-50"
          >
            {adding ? 'Добавляю…' : 'Добавить'}
          </button>
        </form>
      )}

      {tags.length === 0 && options.length === 0 && (
        <p className="text-xs text-ink-soft">
          Тегов пока нет — создать можно на странице «Глоссарий».
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-urgent">{error}</p>}
    </div>
  )
}

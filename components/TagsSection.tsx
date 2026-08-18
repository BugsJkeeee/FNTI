'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tag } from '@/types'

export default function TagsSection({ initialTags }: { initialTags: Tag[] }) {
  const router = useRouter()
  const [tags, setTags] = useState(initialTags)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось добавить тег')
        return
      }
      setTags((prev) => (prev.some((t) => t.id === data.id) ? prev : [data, ...prev]))
      setName('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Теги</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Общий список тегов, которые можно проставлять задачам (видны только внутри самой задачи). Тег «личное» особый — его можно ставить только на свою задачу, и её не увидят остальные на общей доске.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название тега"
          className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
        >
          {loading ? 'Добавляю…' : 'Добавить'}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-urgent">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <p className="text-sm text-ink-soft">Пока нет ни одного тега.</p>
        ) : (
          tags.map((t) => (
            <span key={t.id} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink">
              {t.name}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

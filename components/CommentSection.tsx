'use client'

import { useState } from 'react'
import type { Comment, Employee } from '@/types'

export default function CommentSection({
  taskId,
  initialComments,
  currentEmployee,
}: {
  taskId: string
  initialComments: Comment[]
  currentEmployee: Employee
}) {
  const [comments, setComments] = useState(initialComments)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, text }),
      })
      if (res.ok) {
        const comment = await res.json()
        setComments((prev) => [...prev, { ...comment, author: currentEmployee }])
        setText('')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <h2 className="mb-3 font-display text-base font-semibold text-ink">Комментарии</h2>

      {comments.length === 0 ? (
        <p className="text-sm text-ink-soft">Пока пусто — можно начать обсуждение.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-paper p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">{c.author?.name ?? 'Кто-то'}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-ink-soft">
                    {new Date(c.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {c.author_id === currentEmployee.id && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="text-xs text-ink-soft transition hover:text-urgent disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-ink">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написать комментарий…"
          className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
        >
          Отправить
        </button>
      </form>
    </div>
  )
}

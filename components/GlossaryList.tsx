'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { GlossaryEntry } from '@/types'

export default function GlossaryList({
  entries,
  currentEmployeeId,
  isOwner,
}: {
  entries: GlossaryEntry[]
  currentEmployeeId: string
  isOwner: boolean
}) {
  const router = useRouter()

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('glossary_entries').delete().eq('id', id)
    router.refresh()
  }

  if (entries.length === 0) {
    return <p className="text-sm text-ink-soft">Пока пусто — добавьте первую запись.</p>
  }

  return (
    <div className="divide-y divide-line">
      {entries.map((entry) => {
        const canDelete = isOwner || entry.author_id === currentEmployeeId
        return (
          <div key={entry.id} className="flex items-start justify-between gap-3 py-3">
            <div>
              <p className="text-sm text-ink">{entry.text}</p>
              <p className="mt-1 font-mono text-xs text-ink-soft">
                {entry.author?.name ?? 'неизвестный автор'} · {new Date(entry.created_at).toLocaleDateString('ru-RU')}
              </p>
            </div>
            {canDelete && (
              <button
                onClick={() => handleDelete(entry.id)}
                className="shrink-0 text-xs text-ink-soft transition hover:text-urgent"
              >
                Удалить
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

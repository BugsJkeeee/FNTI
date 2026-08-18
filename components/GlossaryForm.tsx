'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function GlossaryForm({ authorId }: { authorId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText((prev) => (prev.trim() ? `${prev}\n${content}` : content))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('glossary_entries')
      .insert(lines.map((line) => ({ author_id: authorId, text: line })))
    setLoading(false)
    if (error) {
      setError('Не удалось добавить запись')
      return
    }
    setText('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Добавить запись</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Термины, названия клиентов/проектов, принятые сокращения — всё это ИИ будет учитывать при распределении задач.
        Каждая строка станет отдельной записью — можно напечатать одну, вставить сразу много строк или загрузить файл.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={'например:\n«Клиент Аврора» — это ООО «Аврора Строй», основной подрядчик по объекту на Ленина\nКП — коммерческое предложение'}
        className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
      />

      <div className="mt-2 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={handleFileChange}
          className="text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-line file:bg-paper file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-ink file:transition hover:file:border-teal"
        />
      </div>

      {error && <p className="mt-2 text-sm text-urgent">{error}</p>}
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="mt-3 rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
      >
        {loading ? 'Добавляю…' : 'Добавить'}
      </button>
    </form>
  )
}

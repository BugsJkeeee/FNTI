'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { priorityLabels, statusLabels } from '@/components/Badges'
import Spinner from '@/components/Spinner'

type TaskUpdatedField = 'deadline' | 'priority' | 'status' | 'tag_added' | 'tag_removed' | 'description'

type CommentPosted = { type: 'comment_posted'; task_id: string; task_text: string; comment_text: string }
type TaskUpdated = { type: 'task_updated'; task_id: string; task_text: string; field: TaskUpdatedField; new_value: string }
type NeedsChoice = {
  type: 'comment_needs_choice'
  reason: string
  suggested_text: string
  candidates: { id: string; text: string }[]
}

function fieldLabel(field: TaskUpdatedField, value: string) {
  if (field === 'deadline') return `срок → ${new Date(value).toLocaleDateString('ru-RU')}`
  if (field === 'priority') return `приоритет → ${priorityLabels[value as keyof typeof priorityLabels] ?? value}`
  if (field === 'status') return `статус → ${statusLabels[value as keyof typeof statusLabels] ?? value}`
  if (field === 'tag_added') return `добавлен тег «${value}»`
  if (field === 'tag_removed') return `убран тег «${value}»`
  return `описание дополнено: «${value}»`
}

export default function AiCommandBox() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommentPosted | TaskUpdated | null>(null)
  const [choice, setChoice] = useState<NeedsChoice | null>(null)
  const [choiceTaskId, setChoiceTaskId] = useState('')
  const [choiceText, setChoiceText] = useState('')
  const [sendingChoice, setSendingChoice] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setChoice(null)

    try {
      const res = await fetch('/api/ai-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Не удалось выполнить команду')
        return
      }

      if (data.type === 'comment_needs_choice') {
        setChoice(data)
        setChoiceText(data.suggested_text)
        setChoiceTaskId('')
        return
      }

      setResult(data)
      setText('')
      router.refresh()
    } catch {
      setError('Проблема с сетью. Попробуй ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  function cancelChoice() {
    setChoice(null)
    setChoiceTaskId('')
    setChoiceText('')
  }

  async function handleChoiceSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!choiceTaskId || !choiceText.trim()) return
    setSendingChoice(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: choiceTaskId, text: choiceText }),
      })
      if (!res.ok) {
        setError('Не удалось добавить комментарий')
        return
      }
      const chosenTask = choice?.candidates.find((c) => c.id === choiceTaskId)
      setResult({ type: 'comment_posted', task_id: choiceTaskId, task_text: chosenTask?.text ?? '', comment_text: choiceText })
      cancelChoice()
      setText('')
      router.refresh()
    } finally {
      setSendingChoice(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-lg">
      <h2 className="font-display text-base font-semibold text-ink">Команда ИИ</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Умеет добавлять комментарий, дополнять описание, менять срок (в том числе «через две недели», «в последнюю субботу сентября»), приоритет или статус, ставить/убирать тег. Например: «перенеси задачу про отчёт на через две недели» или «допиши в описание задачи про МЭИ, что нужен акт сверки».
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Напиши в задаче про … , что … / перенеси задачу про … на … / поставь тег … на задачу про …"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
        />
        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Spinner />}
          {loading ? 'Думаю…' : 'Выполнить'}
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>}

      {result && result.type === 'comment_posted' && (
        <div className="mt-3 rounded-lg bg-teal-soft px-3 py-2.5 text-sm text-teal">
          <p className="font-medium">Комментарий добавлен.</p>
          <p className="mt-1 text-ink">«{result.comment_text}»</p>
          <Link href={`/tasks/${result.task_id}`} className="mt-1 inline-block underline">
            {result.task_text} →
          </Link>
        </div>
      )}

      {result && result.type === 'task_updated' && (
        <div className="mt-3 rounded-lg bg-teal-soft px-3 py-2.5 text-sm text-teal">
          <p className="font-medium">Задача обновлена: {fieldLabel(result.field, result.new_value)}</p>
          <Link href={`/tasks/${result.task_id}`} className="mt-1 inline-block underline">
            {result.task_text} →
          </Link>
        </div>
      )}

      {choice && (
        <form onSubmit={handleChoiceSubmit} className="mt-3 space-y-3 rounded-lg border border-line bg-paper p-3">
          <p className="text-sm text-ink-soft">{choice.reason} Выбери задачу сам:</p>
          <select
            value={choiceTaskId}
            onChange={(e) => setChoiceTaskId(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal"
          >
            <option value="">— выбери задачу —</option>
            {choice.candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.text}</option>
            ))}
          </select>
          <textarea
            value={choiceText}
            onChange={(e) => setChoiceText(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!choiceTaskId || !choiceText.trim() || sendingChoice}
              className="flex items-center gap-2 rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
            >
              {sendingChoice && <Spinner />}
              {sendingChoice ? 'Отправляю…' : 'Отправить'}
            </button>
            <button
              type="button"
              onClick={cancelChoice}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft hover:text-ink"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

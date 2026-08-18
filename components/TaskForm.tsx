'use client'

import { useEffect, useRef, useState } from 'react'
import type { AiSuggestion, Employee, Priority, Tag } from '@/types'
import { priorityLabels } from '@/components/Badges'
import Spinner from '@/components/Spinner'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function TaskForm({
  employees,
  defaultAssigneeId,
  onCreated,
}: {
  employees: Employee[]
  defaultAssigneeId?: string
  onCreated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ type: 'ai'; suggestion: AiSuggestion } | { type: 'manual' } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualText, setManualText] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [manualAssigneeId, setManualAssigneeId] = useState(defaultAssigneeId ?? employees[0]?.id ?? '')
  const [manualDeadline, setManualDeadline] = useState(todayISO())
  const [manualPriority, setManualPriority] = useState<Priority>('обычный')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [manualTagIds, setManualTagIds] = useState<string[]>([])
  const submittingRef = useRef(false)

  useEffect(() => {
    fetch('/api/tags')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAvailableTags)
      .catch(() => {})
  }, [])

  function toggleManualTag(tagId: string) {
    setManualTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
  }

  function expand() {
    setExpanded(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function collapse() {
    setExpanded(false)
    setText('')
    setError(null)
  }

  function openManual(prefillText: string) {
    setManualText(prefillText)
    setManualDescription('')
    setManualAssigneeId(defaultAssigneeId ?? employees[0]?.id ?? '')
    setManualDeadline(todayISO())
    setManualPriority('обычный')
    setManualTagIds([])
    setManualError(null)
    setManualOpen(true)
  }

  async function handleSubmit() {
    if (!text.trim() || submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError(null)
    setCreated(null)

    try {
      const res = await fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          assigneeHint: employees.find((e) => e.id === defaultAssigneeId)?.name,
        }),
      })
      const suggestion = await res.json()

      if (!res.ok || !suggestion.assignee_id || !suggestion.deadline) {
        setError(suggestion.error ?? 'ИИ не смог разобрать задачу — заполни поля вручную.')
        openManual(text)
        return
      }

      const createRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: suggestion.edited_text ?? text,
          description: suggestion.description ?? null,
          original_text: text,
          assignee_id: suggestion.assignee_id,
          deadline: suggestion.deadline,
          priority: suggestion.priority ?? 'обычный',
          ai_explanation: suggestion.explanation ?? null,
        }),
      })
      const newTask = await createRes.json()

      if (createRes.ok && Array.isArray(suggestion.tag_ids)) {
        suggestion.tag_ids.forEach((tagId: string) => {
          fetch(`/api/tasks/${newTask.id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_id: tagId }),
          })
        })
      }

      setCreated({ type: 'ai', suggestion })
      setText('')
      setExpanded(false)
      onCreated()
    } catch {
      setError('Проблема с сетью. Попробуй ещё раз или заполни вручную.')
      openManual(text)
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    handleSubmit()
  }

  function cancelManual() {
    setManualOpen(false)
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualText.trim() || !manualAssigneeId || !manualDeadline) return
    setManualSaving(true)
    setManualError(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: manualText,
          description: manualDescription || null,
          original_text: manualText,
          assignee_id: manualAssigneeId,
          deadline: manualDeadline,
          priority: manualPriority,
          ai_explanation: null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setManualError(data.error ?? 'Не удалось создать задачу')
        return
      }
      const newTask = await res.json()

      manualTagIds.forEach((tagId) => {
        fetch(`/api/tasks/${newTask.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_id: tagId }),
        })
      })

      setManualOpen(false)
      setError(null)
      setCreated({ type: 'manual' })
      setText('')
      setExpanded(false)
      onCreated()
    } finally {
      setManualSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      {expanded ? (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            rows={2}
            placeholder="Опиши задачу одной строкой — кому, к какому сроку и насколько срочно. ИИ разберётся сам."
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || loading}
              className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Spinner />}
              {loading ? 'Создаю…' : 'Создать задачу'}
            </button>
            <button
              type="button"
              onClick={() => openManual(text)}
              title="Добавить задачу вручную"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-base transition hover:border-teal"
            >
              ✋
            </button>
            <button
              type="button"
              onClick={collapse}
              className="ml-auto rounded-lg px-2 py-2 text-sm text-ink-soft transition hover:text-ink"
            >
              Свернуть
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={expand}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-soft transition hover:border-teal hover:text-teal"
        >
          <span className="text-base font-semibold text-teal">+</span> Новая задача
        </button>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>
      )}

      {created?.type === 'ai' && (
        <div className="mt-3 rounded-lg bg-teal-soft px-3 py-2.5 text-sm text-teal">
          <span className="font-medium">Задача создана.</span> {created.suggestion.explanation}
        </div>
      )}

      {created?.type === 'manual' && (
        <div className="mt-3 rounded-lg bg-teal-soft px-3 py-2.5 text-sm text-teal">
          <span className="font-medium">Задача создана вручную.</span>
        </div>
      )}

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-lg">
            <h3 className="font-display text-base font-semibold text-ink">Добавить задачу вручную</h3>

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Текст задачи</label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Описание (необязательно)</label>
                <textarea
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  rows={3}
                  placeholder="Подробности, контекст, ссылки…"
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Исполнитель</label>
                  <select
                    value={manualAssigneeId}
                    onChange={(e) => setManualAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
                  >
                    <option value="">— выбери —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Срок</label>
                  <input
                    type="date"
                    value={manualDeadline}
                    onChange={(e) => setManualDeadline(e.target.value)}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Приоритет</label>
                  <select
                    value={manualPriority}
                    onChange={(e) => setManualPriority(e.target.value as Priority)}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
                  >
                    <option value="срочно">{priorityLabels['срочно']}</option>
                    <option value="обычный">{priorityLabels['обычный']}</option>
                    <option value="низкий">{priorityLabels['низкий']}</option>
                  </select>
                </div>
              </div>

              {availableTags.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Теги</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => {
                      const selected = manualTagIds.includes(tag.id)
                      return (
                        <button
                          type="button"
                          key={tag.id}
                          onClick={() => toggleManualTag(tag.id)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            selected ? 'border-teal bg-teal-soft text-teal' : 'border-line bg-paper text-ink-soft hover:border-teal'
                          }`}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {manualError && <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{manualError}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelManual}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!manualText.trim() || !manualAssigneeId || !manualDeadline || manualSaving}
                  className="flex items-center gap-2 rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
                >
                  {manualSaving && <Spinner />}
                  {manualSaving ? 'Сохраняю…' : 'Создать задачу'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

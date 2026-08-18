'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee, Priority, Status, Tag, Task } from '@/types'
import { PriorityBadge, StatusBadge, RoleBadge, priorityLabels, statusLabels } from '@/components/Badges'
import TaskTags from '@/components/TaskTags'
import { getDisplayStatus, getTaskRole } from '@/lib/task-status'

export default function TaskDetail({
  task,
  currentEmployee,
  employees,
  initialTags,
  availableTags,
}: {
  task: Task
  currentEmployee: Employee
  employees: Employee[]
  initialTags: Tag[]
  availableTags: Tag[]
}) {
  const router = useRouter()
  const role = getTaskRole(task, currentEmployee.id)
  const canEdit = role === 'author' || role === 'assignee' || role === 'both'
  const canChangeStatus = role === 'assignee' || role === 'both'

  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.text)
  const [description, setDescription] = useState(task.description ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [deadline, setDeadline] = useState(task.deadline ?? '')
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, description, assignee_id: assigneeId, deadline, priority }),
      })
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(status: Status) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Удалить задачу? Это необратимо.')) return
    setDeleting(true)
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      router.push('/board')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  const displayStatus = getDisplayStatus(task)

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-ink-soft">#{task.number}</span>
          <RoleBadge role={role} />
          <PriorityBadge priority={editing ? priority : task.priority} />
          <StatusBadge status={displayStatus} />
        </div>
        {canEdit && !editing && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-teal hover:text-teal"
            >
              Редактировать
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-urgent hover:text-urgent disabled:opacity-50"
            >
              Удалить
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Описание (необязательно)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Подробности, контекст, ссылки…"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
            >
              <option value="срочно">{priorityLabels['срочно']}</option>
              <option value="обычный">{priorityLabels['обычный']}</option>
              <option value="низкий">{priorityLabels['низкий']}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
            >
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft hover:text-ink"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 text-ink">{task.text}</p>
          {task.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{task.description}</p>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-4 font-mono text-xs text-ink-soft">
        <span>Автор: {task.author?.name ?? '—'}</span>
        <span>Исполнитель: {task.assignee?.name ?? '—'}</span>
        <span>Срок: {task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : '—'}</span>
      </div>

      <TaskTags taskId={task.id} initialTags={initialTags} availableTags={availableTags} />

      {canChangeStatus && displayStatus !== 'выполнена' && (
        <div className="mt-4 flex gap-1.5">
          {(['новая', 'в работе', 'выполнена'] as Status[])
            .filter((s) => s !== task.status)
            .map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-ink-soft transition hover:border-teal hover:text-teal"
              >
                → {statusLabels[s]}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import type { Employee, Priority, Task } from '@/types'
import TaskForm from '@/components/TaskForm'
import TaskCard from '@/components/TaskCard'
import { priorityLabels, statusLabels } from '@/components/Badges'
import { getDisplayStatus, isBurning, isOverdue } from '@/lib/task-status'

export default function TeamBoard({
  currentEmployee,
  initialTasks,
  employees,
}: {
  currentEmployee: Employee
  initialTasks: Task[]
  employees: Employee[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [query, setQuery] = useState('')

  const availableTags = useMemo(() => {
    const map = new Map<string, string>()
    tasks.forEach((t) => t.tags?.forEach((tag) => map.set(tag.id, tag.name)))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [tasks])

  async function refresh() {
    const res = await fetch('/api/tasks')
    if (res.ok) setTasks(await res.json())
  }

  const overdue = useMemo(() => tasks.filter((t) => isOverdue(t)), [tasks])
  const burning = useMemo(() => tasks.filter((t) => isBurning(t)), [tasks])
  const done = useMemo(() => tasks.filter((t) => t.status === 'выполнена'), [tasks])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (statusFilter && getDisplayStatus(t) !== statusFilter) return false
      if (tagFilter && !t.tags?.some((tag) => tag.id === tagFilter)) return false
      if (query && !t.text.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [tasks, assigneeFilter, priorityFilter, statusFilter, tagFilter, query])

  return (
    <div className="space-y-8">
      <TaskForm employees={employees} onCreated={refresh} />

      {overdue.length > 0 && (
        <section>
          <h2 className="font-display text-base font-semibold text-overdue">Просроченные</h2>
          <p className="mb-3 text-xs text-ink-soft">Срок уже прошёл, а задача не выполнена.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overdue.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee.id} />
            ))}
          </div>
        </section>
      )}

      {burning.length > 0 && (
        <section>
          <h2 className="font-display text-base font-semibold text-urgent">Требующие внимания</h2>
          <p className="mb-3 text-xs text-ink-soft">Задачи на ближайшие 3 дня со статусом «Важно».</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {burning.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee.id} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">Все задачи</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск…"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
            />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
            >
              <option value="">Все исполнители</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
            >
              <option value="">Любой приоритет</option>
              <option value="срочно">{priorityLabels['срочно']}</option>
              <option value="обычный">{priorityLabels['обычный']}</option>
              <option value="низкий">{priorityLabels['низкий']}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
            >
              <option value="">Любой статус</option>
              <option value="новая">{statusLabels['новая']}</option>
              <option value="в работе">{statusLabels['в работе']}</option>
              <option value="выполнена">{statusLabels['выполнена']}</option>
              <option value="просрочена">{statusLabels['просрочена']}</option>
            </select>
            {availableTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
              >
                <option value="">Любой тег</option>
                {availableTags.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            Ничего не найдено.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee.id} highlightQuery={query} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink-soft">Выполненные</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {done.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

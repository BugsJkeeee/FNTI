'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Employee, Priority, Task } from '@/types'
import TaskForm from '@/components/TaskForm'
import TaskCard from '@/components/TaskCard'
import SummaryStats from '@/components/SummaryStats'
import { priorityLabels, statusLabels } from '@/components/Badges'
import { getDisplayStatus, isBurning, isOverdue } from '@/lib/task-status'
import { useTaskInserted } from '@/lib/hooks/useTaskInserted'

export default function MyDashboard({
  currentEmployee,
  initialTasks,
  employees,
}: {
  currentEmployee: Employee
  initialTasks: Task[]
  employees: Employee[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [tab, setTab] = useState<'assignee' | 'author'>('assignee')
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  async function refresh() {
    const res = await fetch('/api/tasks')
    if (res.ok) setTasks(await res.json())
  }

  useTaskInserted(refresh)

  const myOverdue = useMemo(
    () => tasks.filter((t) => t.assignee_id === currentEmployee.id && isOverdue(t)),
    [tasks, currentEmployee.id]
  )
  const myBurning = useMemo(
    () => tasks.filter((t) => t.assignee_id === currentEmployee.id && isBurning(t)),
    [tasks, currentEmployee.id]
  )

  const asAssignee = useMemo(
    () => tasks.filter((t) => t.assignee_id === currentEmployee.id && t.status !== 'выполнена'),
    [tasks, currentEmployee.id]
  )
  const asAuthor = useMemo(
    () => tasks.filter((t) => t.author_id === currentEmployee.id && t.assignee_id !== currentEmployee.id && t.status !== 'выполнена'),
    [tasks, currentEmployee.id]
  )
  const done = useMemo(() => tasks.filter((t) => t.status === 'выполнена'), [tasks])

  const activeTabAll = tab === 'assignee' ? asAssignee : asAuthor

  const availableTags = useMemo(() => {
    const map = new Map<string, string>()
    activeTabAll.forEach((t) => t.tags?.forEach((tag) => map.set(tag.id, tag.name)))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [activeTabAll])

  const activeTab = useMemo(() => {
    return activeTabAll.filter((t) => {
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (statusFilter && getDisplayStatus(t) !== statusFilter) return false
      if (tagFilter && !t.tags?.some((tag) => tag.id === tagFilter)) return false
      if (query && !t.text.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [activeTabAll, priorityFilter, statusFilter, tagFilter, query])

  return (
    <div className="space-y-8">
      <SummaryStats tasks={tasks} employeeId={currentEmployee.id} />

      {myOverdue.length > 0 && (
        <section>
          <h2 className="font-display text-base font-semibold text-overdue">Просроченные</h2>
          <p className="mb-3 text-xs text-ink-soft">Срок уже прошёл, а задача не выполнена.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myOverdue.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee.id} />
            ))}
          </div>
        </section>
      )}

      {myBurning.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-urgent">Требующие внимания</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myBurning.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee.id} />
            ))}
          </div>
        </section>
      )}

      <section>
        <button
          onClick={() => setShowQuickCreate((v) => !v)}
          className="mb-3 rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light"
        >
          {showQuickCreate ? 'Скрыть форму' : '+ Быстро создать задачу'}
        </button>
        {showQuickCreate && <TaskForm employees={employees} onCreated={refresh} />}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">Мои задачи</h2>
          <Link href="/calendar" className="text-sm text-teal hover:underline">Открыть календарь →</Link>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            <button
              onClick={() => setTab('assignee')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === 'assignee' ? 'bg-graphite text-paper' : 'text-ink-soft hover:bg-paper'}`}
            >
              Я исполнитель ({asAssignee.length})
            </button>
            <button
              onClick={() => setTab('author')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === 'author' ? 'bg-graphite text-paper' : 'text-ink-soft hover:bg-paper'}`}
            >
              Я автор ({asAuthor.length})
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск…"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-teal"
            />
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

        {activeTab.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            Здесь пока пусто.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeTab.map((task) => (
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

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Employee, Priority, Task } from '@/types'
import { PriorityBadge, StatusBadge, priorityLabels, statusLabels } from '@/components/Badges'
import TaskCard from '@/components/TaskCard'
import { getDisplayStatus } from '@/lib/task-status'

const priorityBorder: Record<Priority, string> = {
  'срочно': 'border-urgent-bright',
  'обычный': 'border-normal-bright',
  'низкий': 'border-low-bright',
}

type WeekDay = {
  date: string
  label: string
  isToday: boolean
  tasks: Task[]
}

function DayTaskItem({ task }: { task: Task }) {
  const status = getDisplayStatus(task)
  return (
    <Link
      href={`/tasks/${task.id}`}
      className={`relative block rounded-lg border-2 bg-paper p-3 text-base transition hover:opacity-80 ${priorityBorder[task.priority]}`}
    >
      {task.has_unread_comment && (
        <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-urgent ring-2 ring-paper" />
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink">{task.text}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {!!task.comment_count && (
            <span className="flex items-center gap-1 font-mono text-sm text-ink-soft">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 3.5V14H4a2 2 0 0 1-2-2V4Z" />
              </svg>
              {task.comment_count}
            </span>
          )}
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={status} />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-sm text-ink-soft">
        <span>от {task.author?.name ?? '—'} → {task.assignee?.name ?? '—'}</span>
        <span className="shrink-0">#{task.number}</span>
      </div>
    </Link>
  )
}

export default function CalendarView({
  weekDays,
  otherTasks,
  employees,
  currentEmployeeId,
}: {
  weekDays: WeekDay[]
  otherTasks: Task[]
  employees: Employee[]
  currentEmployeeId: string
}) {
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [query, setQuery] = useState('')

  const availableTags = useMemo(() => {
    const map = new Map<string, string>()
    const all = [...weekDays.flatMap((d) => d.tasks), ...otherTasks]
    all.forEach((t) => t.tags?.forEach((tag) => map.set(tag.id, tag.name)))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [weekDays, otherTasks])

  const visibleWeekDays = useMemo(() => {
    if (!assigneeFilter && !tagFilter) return weekDays
    return weekDays.map((day) => ({
      ...day,
      tasks: day.tasks.filter((t) => {
        if (assigneeFilter && t.assignee_id !== assigneeFilter) return false
        if (tagFilter && !t.tags?.some((tag) => tag.id === tagFilter)) return false
        return true
      }),
    }))
  }, [weekDays, assigneeFilter, tagFilter])

  const filtered = useMemo(() => {
    return otherTasks.filter((t) => {
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (statusFilter && getDisplayStatus(t) !== statusFilter) return false
      if (tagFilter && !t.tags?.some((tag) => tag.id === tagFilter)) return false
      if (query && !t.text.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [otherTasks, assigneeFilter, priorityFilter, statusFilter, tagFilter, query])

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-xs text-ink-soft">Показать задачи:</span>
        <button
          onClick={() => setAssigneeFilter('')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            assigneeFilter === '' ? 'bg-teal text-white' : 'bg-graphite text-paper hover:bg-graphite-light'
          }`}
        >
          Все
        </button>
        {employees.map((e) => (
          <button
            key={e.id}
            onClick={() => setAssigneeFilter((prev) => (prev === e.id ? '' : e.id))}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              assigneeFilter === e.id
                ? 'bg-teal text-white ring-2 ring-teal ring-offset-2'
                : 'bg-graphite text-paper hover:bg-graphite-light'
            }`}
          >
            {e.name}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">На этой неделе</h2>
        <div className="space-y-3">
          {visibleWeekDays.map((day) => (
            <div
              key={day.date}
              className={`rounded-xl border bg-white p-4 ${day.isToday ? 'border-teal' : 'border-line'}`}
            >
              <p className={`font-mono text-sm font-medium capitalize ${day.isToday ? 'text-teal' : 'text-ink-soft'}`}>
                {day.label}
              </p>
              <div className="mt-2 space-y-2">
                {day.tasks.length === 0 ? (
                  <p className="text-sm text-ink-soft">Нет задач</p>
                ) : (
                  day.tasks.map((task) => <DayTaskItem key={task.id} task={task} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">Остальные задачи</h2>
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

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            Ничего не найдено.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployeeId} highlightQuery={query} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

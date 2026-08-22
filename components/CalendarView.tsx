'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Employee, Priority, Task } from '@/types'
import { priorityLabels, statusLabels } from '@/components/Badges'
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

const statusDot: Record<ReturnType<typeof getDisplayStatus>, string> = {
  'новая': 'bg-teal',
  'в работе': 'bg-normal',
  'выполнена': 'bg-done',
  'просрочена': 'bg-overdue',
}

function DayTaskItem({ task }: { task: Task }) {
  const status = getDisplayStatus(task)
  return (
    <Link
      href={`/tasks/${task.id}?from=calendar`}
      title={task.text}
      className={`relative block rounded-md border bg-paper px-1.5 py-1 text-xs transition hover:opacity-80 ${priorityBorder[task.priority]}`}
    >
      {task.has_unread_comment && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-urgent ring-2 ring-paper" />
      )}
      <div className="flex items-start gap-1">
        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[status]}`} />
        <p className="break-words text-ink">{task.text}</p>
      </div>
      <p className="mt-0.5 truncate pl-2.5 font-mono text-[10px] text-ink-soft">→ {task.assignee?.name ?? '—'}</p>
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
    <div className="mt-4 space-y-5">
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
        <h2 className="mb-2 font-display text-base font-semibold text-ink">На этой неделе</h2>
        <div className="overflow-x-auto">
          <div className="grid min-w-[840px] grid-cols-7 gap-2">
            {visibleWeekDays.map((day) => (
              <div
                key={day.date}
                className={`rounded-lg border bg-white p-2 ${day.isToday ? 'border-teal' : 'border-line'}`}
              >
                <p className={`text-center font-mono text-[11px] font-medium capitalize ${day.isToday ? 'text-teal' : 'text-ink-soft'}`}>
                  {day.label}
                </p>
                <div className="mt-1.5 space-y-1">
                  {day.tasks.length === 0 ? (
                    <p className="text-center text-[11px] text-ink-soft">—</p>
                  ) : (
                    day.tasks.map((task) => <DayTaskItem key={task.id} task={task} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployeeId} highlightQuery={query} from="calendar" />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

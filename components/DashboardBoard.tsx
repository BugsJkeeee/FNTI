'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Employee, Priority, Status, Task } from '@/types'
import { getDisplayStatus } from '@/lib/task-status'
import { useTaskInserted } from '@/lib/hooks/useTaskInserted'

const priorityBorder: Record<Priority, string> = {
  'срочно': 'border-urgent-bright',
  'обычный': 'border-normal-bright',
  'низкий': 'border-low-bright',
}

// Порядок групп внутри колонки: сначала в работе, потом новые, потом завершённые.
const GROUPS: { status: Status; label: string }[] = [
  { status: 'в работе', label: 'В работе' },
  { status: 'новая', label: 'Новые' },
  { status: 'выполнена', label: 'Завершено' },
]

function DashboardTaskItem({
  task,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  dragging: boolean
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDragEnd: () => void
}) {
  const overdue = getDisplayStatus(task) === 'просрочена'

  return (
    <Link
      href={`/tasks/${task.id}?from=dashboard`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={`relative block cursor-grab rounded-md border-l-4 bg-paper px-1.5 py-1 text-[11px] transition hover:opacity-80 active:cursor-grabbing ${
        dragging ? 'opacity-30' : ''
      } ${priorityBorder[task.priority]}`}
    >
      {task.has_unread_comment && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-urgent ring-2 ring-paper" />
      )}
      <div className="flex items-start justify-between gap-1.5">
        <p className="line-clamp-2 leading-snug text-ink">{task.text}</p>
        <span className="shrink-0 font-mono text-[9px] text-ink-soft">#{task.number}</span>
      </div>
      {(task.priority === 'срочно' || overdue || task.deadline) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {task.priority === 'срочно' && (
            <span className="rounded-full bg-urgent-soft px-1 py-0.5 font-mono text-[8px] font-medium text-urgent">Срочно</span>
          )}
          {overdue && (
            <span className="rounded-full bg-urgent-soft px-1 py-0.5 font-mono text-[8px] font-medium text-overdue">Просрочена</span>
          )}
          {task.deadline && (
            <span className="font-mono text-[8px] text-ink-soft">
              {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

type DropTarget = { employeeId: string; status: Status }

function targetsEqual(a: DropTarget, b: DropTarget) {
  return a.employeeId === b.employeeId && a.status === b.status
}

export default function DashboardBoard({
  employees,
  initialTasks,
}: {
  employees: Employee[]
  initialTasks: Task[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<DropTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const dragClientXRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    }
  }, [])

  useTaskInserted(async () => {
    const res = await fetch('/api/tasks')
    if (res.ok) setTasks(await res.json())
  })

  // Автоскролл колонок по горизонтали, пока курсор с перетаскиваемой задачей
  // держится у левого/правого края видимой области — иначе сотрудников,
  // не помещающихся на экране, было бы нечем достать при drag-and-drop.
  useEffect(() => {
    if (!draggingTaskId) {
      dragClientXRef.current = null
      return
    }

    const EDGE = 70
    const MAX_SPEED = 14
    let frame: number

    function tick() {
      const container = scrollContainerRef.current
      const x = dragClientXRef.current
      if (container && x !== null) {
        const rect = container.getBoundingClientRect()
        if (x > rect.right - EDGE) {
          container.scrollLeft += MAX_SPEED * Math.min(1, (x - (rect.right - EDGE)) / EDGE)
        } else if (x < rect.left + EDGE) {
          container.scrollLeft -= MAX_SPEED * Math.min(1, (rect.left + EDGE - x) / EDGE)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [draggingTaskId])

  function handleContainerDragOver(e: React.DragEvent) {
    dragClientXRef.current = e.clientX
  }

  function showNotice(message: string) {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }

  const tasksByEmployee = useMemo(() => {
    const map = new Map<string, Task[]>()
    employees.forEach((e) => map.set(e.id, tasks.filter((t) => t.assignee_id === e.id)))
    return map
  }, [employees, tasks])

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
    setDraggingTaskId(taskId)
  }

  function handleDragEnd() {
    setDraggingTaskId(null)
    setHoverTarget(null)
  }

  async function handleDrop(e: React.DragEvent, target: DropTarget) {
    e.preventDefault()
    setHoverTarget(null)
    const taskId = e.dataTransfer.getData('text/plain') || draggingTaskId
    setDraggingTaskId(null)
    if (!taskId) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const assigneeChanged = task.assignee_id !== target.employeeId
    const statusChanged = task.status !== target.status
    if (!assigneeChanged && !statusChanged) return

    const updates: Partial<Pick<Task, 'assignee_id' | 'status'>> = {}
    if (assigneeChanged) updates.assignee_id = target.employeeId
    if (statusChanged) updates.status = target.status

    const previous = tasks
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setTasks(previous)
        showNotice(data.error ?? 'Не удалось перенести задачу')
      }
    } catch {
      setTasks(previous)
      showNotice('Проблема с сетью — не удалось перенести задачу')
    }
  }

  return (
    <div>
      <div ref={scrollContainerRef} onDragOver={handleContainerDragOver} className="flex gap-3 overflow-x-auto pb-2">
        {employees.map((employee) => {
          const empTasks = tasksByEmployee.get(employee.id) ?? []
          return (
            <div key={employee.id} className="min-w-64 flex-1 rounded-xl border border-line bg-white p-2.5">
              <div className="flex items-center justify-between border-b border-line pb-1.5">
                <h2 className="font-display text-xs font-semibold text-ink">{employee.name}</h2>
                <span className="font-mono text-[10px] text-ink-soft">{empTasks.length} всего</span>
              </div>

              <div className="mt-2 space-y-2.5">
                {GROUPS.map(({ status, label }) => {
                  const groupTasks = empTasks.filter((t) => t.status === status)
                  const target: DropTarget = { employeeId: employee.id, status }
                  const isHover = hoverTarget && targetsEqual(hoverTarget, target)
                  return (
                    <div
                      key={status}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (!hoverTarget || !targetsEqual(hoverTarget, target)) setHoverTarget(target)
                      }}
                      onDragLeave={() => setHoverTarget((prev) => (prev && targetsEqual(prev, target) ? null : prev))}
                      onDrop={(e) => handleDrop(e, target)}
                      className={`rounded-lg p-1 transition ${isHover ? 'bg-teal-soft ring-2 ring-teal ring-inset' : ''}`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <h3 className="font-mono text-[10px] font-medium text-ink-soft">{label}</h3>
                        <span className="font-mono text-[10px] text-ink-soft">{groupTasks.length}</span>
                      </div>
                      {groupTasks.length === 0 ? (
                        <p className="text-[10px] text-ink-soft/60">пусто</p>
                      ) : (
                        <div className="space-y-1">
                          {groupTasks.map((t) => (
                            <DashboardTaskItem
                              key={t.id}
                              task={t}
                              dragging={draggingTaskId === t.id}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-urgent px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'
import type { Priority, Task } from '@/types'
import { PriorityBadge, StatusBadge, RoleBadge } from '@/components/Badges'
import HighlightMatch from '@/components/HighlightMatch'
import { getDisplayStatus, getTaskRole } from '@/lib/task-status'

const priorityBorder: Record<Priority, string> = {
  'срочно': 'border-urgent-bright',
  'обычный': 'border-normal-bright',
  'низкий': 'border-low-bright',
}

export default function TaskCard({
  task,
  currentEmployeeId,
  highlightQuery,
}: {
  task: Task
  currentEmployeeId: string
  highlightQuery?: string
}) {
  const displayStatus = getDisplayStatus(task)
  const role = getTaskRole(task, currentEmployeeId)
  const isDone = displayStatus === 'выполнена'

  const formattedDeadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : '—'

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={`relative block rounded-xl border-2 p-4 transition hover:opacity-80 ${
        isDone ? 'border-line bg-line/40' : `bg-white ${priorityBorder[task.priority]}`
      }`}
    >
      {task.has_unread_comment && (
        <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-urgent ring-2 ring-paper" />
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">
          {highlightQuery ? <HighlightMatch text={task.text} query={highlightQuery} /> : task.text}
        </p>
        <div className="flex shrink-0 items-center gap-2 font-mono text-xs text-ink-soft">
          {!!task.comment_count && (
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 3.5V14H4a2 2 0 0 1-2-2V4Z" />
              </svg>
              {task.comment_count}
            </span>
          )}
          <span>{formattedDeadline}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RoleBadge role={role} />
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={displayStatus} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-xs text-ink-soft">
        <div className="flex gap-3">
          <span>от {task.author?.name ?? '—'}</span>
          <span>→ {task.assignee?.name ?? '—'}</span>
        </div>
        <span className="shrink-0">#{task.number}</span>
      </div>
    </Link>
  )
}

import type { Priority, Status } from '@/types'
import type { TaskRole } from '@/lib/task-status'

const priorityStyles: Record<Priority, string> = {
  'срочно': 'bg-urgent-soft text-urgent',
  'обычный': 'bg-normal-soft text-normal',
  'низкий': 'bg-low-soft text-low',
}

export const priorityLabels: Record<Priority, string> = {
  'срочно': 'Срочно',
  'обычный': 'Обычный',
  'низкий': 'Низкий',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${priorityStyles[priority]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {priorityLabels[priority]}
    </span>
  )
}

const statusStyles: Record<Status, string> = {
  'новая': 'bg-teal-soft text-teal',
  'в работе': 'bg-normal-soft text-normal',
  'выполнена': 'bg-low-soft text-done',
  'просрочена': 'bg-urgent-soft text-overdue',
}

export const statusLabels: Record<Status, string> = {
  'новая': 'Новая',
  'в работе': 'В работе',
  'выполнена': 'Выполнена',
  'просрочена': 'Просрочена',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  )
}

const roleLabels: Record<TaskRole, string> = {
  author: 'Автор',
  assignee: 'Исполнитель',
  both: 'Автор и исполнитель',
  none: '',
}

const roleStyles: Record<TaskRole, string> = {
  author: 'border-graphite text-graphite',
  assignee: 'border-teal text-teal',
  both: 'border-ink text-ink',
  none: '',
}

export function RoleBadge({ role }: { role: TaskRole }) {
  if (role === 'none') return null
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${roleStyles[role]}`}>
      {roleLabels[role]}
    </span>
  )
}

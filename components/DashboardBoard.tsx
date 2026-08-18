import Link from 'next/link'
import type { Employee, Priority, Status, Task } from '@/types'
import { getDisplayStatus } from '@/lib/task-status'

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

function DashboardTaskItem({ task }: { task: Task }) {
  const overdue = getDisplayStatus(task) === 'просрочена'

  return (
    <Link
      href={`/tasks/${task.id}?from=dashboard`}
      className={`relative block rounded-lg border-l-4 bg-paper p-2.5 text-sm transition hover:opacity-80 ${priorityBorder[task.priority]}`}
    >
      {task.has_unread_comment && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-urgent ring-2 ring-paper" />
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-ink">{task.text}</p>
        <span className="shrink-0 font-mono text-[11px] text-ink-soft">#{task.number}</span>
      </div>
      {(task.priority === 'срочно' || overdue || task.deadline) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {task.priority === 'срочно' && (
            <span className="rounded-full bg-urgent-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-urgent">Срочно</span>
          )}
          {overdue && (
            <span className="rounded-full bg-urgent-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-overdue">Просрочена</span>
          )}
          {task.deadline && (
            <span className="font-mono text-[10px] text-ink-soft">
              {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

export default function DashboardBoard({
  employees,
  tasksByEmployee,
}: {
  employees: Employee[]
  tasksByEmployee: Map<string, Task[]>
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {employees.map((employee) => {
        const tasks = tasksByEmployee.get(employee.id) ?? []
        return (
          <div key={employee.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h2 className="font-display text-sm font-semibold text-ink">{employee.name}</h2>
              <span className="font-mono text-xs text-ink-soft">{tasks.length} всего</span>
            </div>

            <div className="mt-3 space-y-4">
              {GROUPS.map(({ status, label }) => {
                const groupTasks = tasks.filter((t) => t.status === status)
                return (
                  <div key={status}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <h3 className="font-mono text-xs font-medium text-ink-soft">{label}</h3>
                      <span className="font-mono text-xs text-ink-soft">{groupTasks.length}</span>
                    </div>
                    {groupTasks.length === 0 ? (
                      <p className="text-xs text-ink-soft/60">пусто</p>
                    ) : (
                      <div className="space-y-1.5">
                        {groupTasks.map((t) => (
                          <DashboardTaskItem key={t.id} task={t} />
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
  )
}

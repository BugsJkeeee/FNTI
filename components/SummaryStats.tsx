import type { Task } from '@/types'

export default function SummaryStats({ tasks, employeeId }: { tasks: Task[]; employeeId: string }) {
  const activeAsAssignee = tasks.filter((t) => t.assignee_id === employeeId && t.status !== 'выполнена').length
  const postedByMe = tasks.filter((t) => t.author_id === employeeId).length

  const myClosed = tasks.filter((t) => t.assignee_id === employeeId && t.status === 'выполнена')
  const avgDays = myClosed.length
    ? Math.round(
        myClosed.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime()
          const updated = new Date(t.updated_at).getTime()
          return sum + (updated - created) / 86400000
        }, 0) / myClosed.length
      )
    : null

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-line bg-white p-4 text-center">
        <p className="font-display text-2xl font-semibold text-ink">{activeAsAssignee}</p>
        <p className="mt-0.5 text-xs text-ink-soft">активных задач у меня</p>
      </div>
      <div className="rounded-xl border border-line bg-white p-4 text-center">
        <p className="font-display text-2xl font-semibold text-ink">{postedByMe}</p>
        <p className="mt-0.5 text-xs text-ink-soft">поставлено мной</p>
      </div>
      <div className="rounded-xl border border-line bg-white p-4 text-center">
        <p className="font-display text-2xl font-semibold text-ink">{avgDays ?? '—'}</p>
        <p className="mt-0.5 text-xs text-ink-soft">дней на закрытие в среднем</p>
      </div>
    </div>
  )
}

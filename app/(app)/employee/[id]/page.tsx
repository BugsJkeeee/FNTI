import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo, filterVisibleTasks } from '@/lib/tags'
import TaskCard from '@/components/TaskCard'
import EmployeeQuickCreate from '@/components/EmployeeQuickCreate'
import RealtimeTaskRefresher from '@/components/RealtimeTaskRefresher'
import type { Employee, Task } from '@/types'

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentEmployee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data: person } = await supabase.from('employees').select('*').eq('id', id).single()
  if (!person) notFound()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization)')
    .eq('assignee_id', id)
    .order('created_at', { ascending: false })

  const { data: employees } = await supabase.from('employees').select('*').order('name')

  const withComments = await attachCommentInfo(supabase, (tasks as Task[]) ?? [], currentEmployee!.id)
  const withTags = await attachTagInfo(supabase, withComments)
  const all = filterVisibleTasks(withTags, currentEmployee!.id)
  const active = all.filter((t) => t.status !== 'выполнена')
  const done = all.filter((t) => t.status === 'выполнена')

  return (
    <div className="space-y-5">
      <RealtimeTaskRefresher />
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">{person.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">{person.specialization || 'специализация не указана'} · {person.email}</p>
      </div>

      <EmployeeQuickCreate
        employees={(employees as Employee[]) ?? []}
        defaultAssigneeId={id}
        personName={person.name}
      />

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Активные задачи</h2>
        {active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            Активных задач нет.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee!.id} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-ink-soft">Выполненные</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {done.map((task) => (
              <TaskCard key={task.id} task={task} currentEmployeeId={currentEmployee!.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo, filterVisibleTasks } from '@/lib/tags'
import DashboardBoard from '@/components/DashboardBoard'
import type { Employee, Task } from '@/types'

export default async function DashboardPage() {
  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      '*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization), project:projects(id, number, wave, code)'
    )
    .order('created_at', { ascending: false })

  const { data: employees } = await supabase.from('employees').select('*').order('created_at', { ascending: true })

  const tasksWithComments = await attachCommentInfo(supabase, (tasks as Task[]) ?? [], employee!.id)
  const tasksWithTags = await attachTagInfo(supabase, tasksWithComments)
  const visibleTasks = filterVisibleTasks(tasksWithTags, employee!.id)

  const team = (employees as Employee[]) ?? []

  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Дашборд команды</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Задачи каждого участника: сначала в работе, потом новые, потом завершённые. Задачу можно перетащить на другого
        исполнителя или в другой статус.
      </p>

      <div className="mt-4">
        <DashboardBoard employees={team} initialTasks={visibleTasks} />
      </div>
    </div>
  )
}

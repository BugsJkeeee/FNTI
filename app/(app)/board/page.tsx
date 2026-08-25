import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo, filterVisibleTasks } from '@/lib/tags'
import TeamBoard from '@/components/TeamBoard'
import type { Employee, Task } from '@/types'

export default async function BoardPage() {
  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      '*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization), project:projects(id, number, wave, code)'
    )
    .order('created_at', { ascending: false })

  const { data: employees } = await supabase.from('employees').select('*').order('name')

  const tasksWithComments = await attachCommentInfo(supabase, (tasks as Task[]) ?? [], employee!.id)
  const tasksWithExtras = await attachTagInfo(supabase, tasksWithComments)
  const visibleTasks = filterVisibleTasks(tasksWithExtras, employee!.id)

  return (
    <TeamBoard
      currentEmployee={employee!}
      initialTasks={visibleTasks}
      employees={(employees as Employee[]) ?? []}
    />
  )
}

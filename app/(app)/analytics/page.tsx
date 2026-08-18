import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachTagInfo } from '@/lib/tags'
import AnalyticsTable from '@/components/AnalyticsTable'
import RealtimeTaskRefresher from '@/components/RealtimeTaskRefresher'
import type { Employee, Task } from '@/types'
import { getDisplayStatus } from '@/lib/task-status'

export default async function AnalyticsPage() {
  const currentEmployee = await getCurrentEmployee()
  const supabase = await createClient()
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: employees } = await supabase.from('employees').select('*').order('name')

  const all = await attachTagInfo(supabase, (tasks as Task[]) ?? [])
  const team = (employees as Employee[]) ?? []

  const rows = team.map((employee) => {
    const allTasks = all.filter((t) => t.assignee_id === employee.id)
    const activeTasks = allTasks.filter((t) => t.status !== 'выполнена')
    const overdueTasks = allTasks.filter((t) => getDisplayStatus(t) === 'просрочена')
    const closedTasks = allTasks.filter((t) => t.status === 'выполнена')
    const avgDays = closedTasks.length
      ? Math.round(
          closedTasks.reduce((sum, t) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86400000, 0) /
            closedTasks.length
        )
      : null

    return { employee, activeTasks, closedTasks, overdueTasks, avgDays }
  })

  const totalOverdueTasks = all.filter((t) => getDisplayStatus(t) === 'просрочена')
  const totalActiveTasks = all.filter((t) => t.status !== 'выполнена')

  return (
    <div>
      <RealtimeTaskRefresher />
      <h1 className="font-display text-xl font-semibold text-ink">Аналитика команды</h1>
      <p className="mt-1 text-sm text-ink-soft">Загрузка и темп выполнения по каждому участнику.</p>

      <AnalyticsTable
        rows={rows}
        totalActiveTasks={totalActiveTasks}
        totalOverdueTasks={totalOverdueTasks}
        currentEmployeeId={currentEmployee!.id}
      />
    </div>
  )
}

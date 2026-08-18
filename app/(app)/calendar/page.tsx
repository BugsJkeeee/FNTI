import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo, filterVisibleTasks } from '@/lib/tags'
import CalendarView from '@/components/CalendarView'
import RealtimeTaskRefresher from '@/components/RealtimeTaskRefresher'
import type { Employee, Task } from '@/types'

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default async function CalendarPage() {
  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOfWeek = today.getDay() // 0 = вс ... 6 = сб
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + diffToMonday)

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization)')
    .not('deadline', 'is', null)
    .neq('status', 'выполнена')
    .order('deadline', { ascending: true })

  const { data: employees } = await supabase.from('employees').select('*').order('name')

  const withComments = await attachCommentInfo(supabase, (tasks as Task[]) ?? [], employee!.id)
  const withTags = await attachTagInfo(supabase, withComments)
  const all = filterVisibleTasks(withTags, employee!.id)
  const todayISO = toISODate(today)
  const weekStartISO = toISODate(weekDates[0])
  const weekEndISO = toISODate(weekDates[6])

  const weekDays = weekDates.map((d) => {
    const iso = toISODate(d)
    return {
      date: iso,
      label: d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
      isToday: iso === todayISO,
      tasks: all.filter((t) => t.deadline === iso),
    }
  })

  const otherTasks = all.filter((t) => t.deadline! < weekStartISO || t.deadline! > weekEndISO)

  return (
    <div>
      <RealtimeTaskRefresher />
      <h1 className="font-display text-xl font-semibold text-ink">Календарь команды</h1>
      <p className="mt-1 text-sm text-ink-soft">Сроки, приоритеты и содержание всех активных задач.</p>

      <CalendarView
        weekDays={weekDays}
        otherTasks={otherTasks}
        employees={(employees as Employee[]) ?? []}
        currentEmployeeId={employee!.id}
      />
    </div>
  )
}

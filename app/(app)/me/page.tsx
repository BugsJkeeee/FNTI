import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo } from '@/lib/tags'
import MyDashboard from '@/components/MyDashboard'
import ActivityFeed from '@/components/ActivityFeed'
import ProfileForm from '@/components/ProfileForm'
import TelegramLinkCard from '@/components/TelegramLinkCard'
import type { Employee, Task } from '@/types'

export default async function MePage() {
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

  const myTaskIds = (tasks as Task[] ?? [])
    .filter((t) => t.author_id === employee!.id || t.assignee_id === employee!.id)
    .map((t) => t.id)

  let activity: {
    id: string
    task_id: string
    change_description: string
    changed_at: string
    changed_by_name: string | null
    task_text: string | null
  }[] = []

  if (myTaskIds.length > 0) {
    const { data: history } = await supabase
      .from('task_history')
      .select('id, task_id, change_description, changed_at, changed_by:employees(name), task:tasks(text)')
      .in('task_id', myTaskIds)
      .order('changed_at', { ascending: false })
      .limit(10)

    activity = (history ?? []).map((h) => ({
      id: h.id,
      task_id: h.task_id,
      change_description: h.change_description,
      changed_at: h.changed_at,
      changed_by_name: (h.changed_by as unknown as { name: string } | null)?.name ?? null,
      task_text: (h.task as unknown as { text: string } | null)?.text ?? null,
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Личный кабинет</h1>
        <p className="mt-1 text-sm text-ink-soft">Привет, {employee!.name}.</p>
      </div>

      <MyDashboard
        currentEmployee={employee!}
        initialTasks={tasksWithExtras}
        employees={(employees as Employee[]) ?? []}
      />

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Лента активности</h2>
        <ActivityFeed items={activity} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Профиль</h2>
        <ProfileForm employee={employee!} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Telegram</h2>
        <TelegramLinkCard employee={employee!} />
      </section>
    </div>
  )
}

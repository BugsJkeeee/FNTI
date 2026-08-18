import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import TaskDetail from '@/components/TaskDetail'
import CommentSection from '@/components/CommentSection'
import type { Comment, Employee, Tag, Task } from '@/types'

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams

  const backTargets: Record<string, { href: string; label: string }> = {
    calendar: { href: '/calendar', label: '← Назад к календарю' },
    analytics: { href: '/analytics', label: '← Назад к аналитике' },
    dashboard: { href: '/dashboard', label: '← Назад к дашборду' },
  }
  const { href: backHref, label: backLabel } = backTargets[from ?? ''] ?? { href: '/board', label: '← Назад к доске' }

  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization)')
    .eq('id', id)
    .single()

  if (!task) notFound()

  const { data: comments } = await supabase
    .from('task_comments')
    .select('*, author:employees(id, name)')
    .eq('task_id', id)
    .order('created_at', { ascending: true })

  const { data: employees } = await supabase.from('employees').select('*').order('name')

  const { data: taskTags } = await supabase.from('task_tags').select('tag:tags(*)').eq('task_id', id)
  const tags = ((taskTags ?? []) as unknown as { tag: Tag | null }[]).map((t) => t.tag).filter((t): t is Tag => !!t)

  const { data: allTags } = await supabase.from('tags').select('*').order('name')

  await supabase
    .from('task_views')
    .upsert({ task_id: id, employee_id: employee!.id, viewed_at: new Date().toISOString() })

  return (
    <div className="space-y-6">
      <Link href={backHref} className="text-sm text-ink-soft hover:text-ink">{backLabel}</Link>

      <TaskDetail
        task={task as Task}
        currentEmployee={employee!}
        employees={(employees as Employee[]) ?? []}
        initialTags={tags}
        availableTags={(allTags as Tag[]) ?? []}
      />

      <div className="rounded-2xl border border-line bg-white p-6">
        <CommentSection
          taskId={id}
          initialComments={(comments as Comment[]) ?? []}
          currentEmployee={employee!}
        />
      </div>
    </div>
  )
}

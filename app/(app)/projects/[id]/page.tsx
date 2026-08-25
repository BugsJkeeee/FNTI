import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo, filterVisibleTasks } from '@/lib/tags'
import ProjectDetail from '@/components/ProjectDetail'
import type { Employee, Project, Task } from '@/types'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select(
      '*, contracts:project_contracts(*), stages:project_stages(*, checklist_items:project_checklist_items(*), claims:project_claims(*)), comments:project_comments(*, author:employees(id, name)), payments:project_payments(*)'
    )
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: employees } = await supabase.from('employees').select('*').order('name')

  const { data: projectTasks } = await supabase
    .from('tasks')
    .select(
      '*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization)'
    )
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const tasksWithComments = await attachCommentInfo(supabase, (projectTasks as Task[]) ?? [], employee!.id)
  const tasksWithTags = await attachTagInfo(supabase, tasksWithComments)
  const visibleTasks = filterVisibleTasks(tasksWithTags, employee!.id)

  await supabase
    .from('project_views')
    .upsert({ project_id: id, employee_id: employee!.id, viewed_at: new Date().toISOString() })

  return (
    <div className="space-y-4">
      <Link href="/projects" className="text-sm text-ink-soft hover:text-ink">← Назад к проектам</Link>
      <ProjectDetail
        project={project as Project}
        currentEmployee={employee!}
        employees={(employees as Employee[]) ?? []}
        initialTasks={visibleTasks}
      />
    </div>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import ProjectDetail from '@/components/ProjectDetail'
import type { Project } from '@/types'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select(
      '*, contracts:project_contracts(*), stages:project_stages(*, checklist_items:project_checklist_items(*)), comments:project_comments(*, author:employees(id, name))'
    )
    .eq('id', id)
    .single()

  if (!project) notFound()

  await supabase
    .from('project_views')
    .upsert({ project_id: id, employee_id: employee!.id, viewed_at: new Date().toISOString() })

  return (
    <div className="space-y-6">
      <Link href="/projects" className="text-sm text-ink-soft hover:text-ink">← Назад к проектам</Link>
      <ProjectDetail project={project as Project} currentEmployee={employee!} />
    </div>
  )
}

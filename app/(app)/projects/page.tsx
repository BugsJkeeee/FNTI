import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachProjectCommentInfo } from '@/lib/project-comments'
import ProjectList from '@/components/ProjectList'
import type { Project } from '@/types'

export default async function ProjectsPage() {
  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select(
      '*, stages:project_stages(*, checklist_items:project_checklist_items(*)), comments:project_comments(*, author:employees(name))'
    )
    .order('wave', { ascending: true })
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('number', { ascending: true })

  const projectsWithComments = await attachProjectCommentInfo(supabase, (projects as Project[]) ?? [], employee!.id)

  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Проекты НИОКР</h1>

      <div className="mt-6">
        <ProjectList initialProjects={projectsWithComments} />
      </div>
    </div>
  )
}

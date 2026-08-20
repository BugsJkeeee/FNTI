import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project } from '@/types'

/** Считает comment_count/has_unread_comment по проектам — аналог attachCommentInfo() для задач (lib/comments.ts). */
export async function attachProjectCommentInfo<T extends Project>(
  supabase: SupabaseClient,
  projects: T[],
  currentEmployeeId: string
): Promise<T[]> {
  if (projects.length === 0) return projects

  const ids = projects.map((p) => p.id)

  const [{ data: comments }, { data: views }] = await Promise.all([
    supabase.from('project_comments').select('project_id, author_id, created_at').in('project_id', ids),
    supabase.from('project_views').select('project_id, viewed_at').eq('employee_id', currentEmployeeId).in('project_id', ids),
  ])

  const viewMap = new Map<string, string>((views ?? []).map((v) => [v.project_id, v.viewed_at]))

  const commentsByProject = new Map<string, { author_id: string | null; created_at: string }[]>()
  ;(comments ?? []).forEach((c) => {
    const list = commentsByProject.get(c.project_id) ?? []
    list.push(c)
    commentsByProject.set(c.project_id, list)
  })

  return projects.map((p) => {
    const projectComments = commentsByProject.get(p.id) ?? []
    const lastViewed = viewMap.get(p.id)
    const hasUnread = projectComments.some(
      (c) => c.author_id !== currentEmployeeId && (!lastViewed || c.created_at > lastViewed)
    )
    return { ...p, comment_count: projectComments.length, has_unread_comment: hasUnread }
  })
}

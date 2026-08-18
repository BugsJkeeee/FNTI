import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task } from '@/types'

export async function attachCommentInfo<T extends Task>(
  supabase: SupabaseClient,
  tasks: T[],
  currentEmployeeId: string
): Promise<T[]> {
  if (tasks.length === 0) return tasks

  const ids = tasks.map((t) => t.id)

  const [{ data: comments }, { data: views }] = await Promise.all([
    supabase.from('task_comments').select('task_id, author_id, created_at').in('task_id', ids),
    supabase.from('task_views').select('task_id, viewed_at').eq('employee_id', currentEmployeeId).in('task_id', ids),
  ])

  const viewMap = new Map<string, string>((views ?? []).map((v) => [v.task_id, v.viewed_at]))

  const commentsByTask = new Map<string, { author_id: string | null; created_at: string }[]>()
  ;(comments ?? []).forEach((c) => {
    const list = commentsByTask.get(c.task_id) ?? []
    list.push(c)
    commentsByTask.set(c.task_id, list)
  })

  return tasks.map((t) => {
    const taskComments = commentsByTask.get(t.id) ?? []
    const lastViewed = viewMap.get(t.id)
    const hasUnread = taskComments.some(
      (c) => c.author_id !== currentEmployeeId && (!lastViewed || c.created_at > lastViewed)
    )
    return { ...t, comment_count: taskComments.length, has_unread_comment: hasUnread }
  })
}

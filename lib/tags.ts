import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task } from '@/types'

export const PRIVATE_TAG_NAME = 'личное'

export function isPrivateTagName(name: string): boolean {
  return name.trim().toLowerCase() === PRIVATE_TAG_NAME
}

export function isPrivateTask(task: Task): boolean {
  return !!task.tags?.some((t) => isPrivateTagName(t.name))
}

// Тег "личное" можно ставить только на задачу, где сам себе и автор, и исполнитель.
export function isTaskOwner(task: Task, employeeId: string): boolean {
  return task.author_id === employeeId && task.assignee_id === employeeId
}

// Та же проверка, но по сырым id — удобно, когда под рукой нет полного объекта Task
// (например, после отдельного select('author_id, assignee_id') в route handler'е).
export function canSetPrivateTag(authorId: string | null, assigneeId: string | null, employeeId: string): boolean {
  return authorId === employeeId && assigneeId === employeeId
}

// Скрывает задачи с тегом "личное" от всех, кроме автора/исполнителя.
export function filterVisibleTasks<T extends Task>(tasks: T[], viewerId: string): T[] {
  return tasks.filter((t) => !isPrivateTask(t) || isTaskOwner(t, viewerId))
}

export async function attachTagInfo<T extends Task>(supabase: SupabaseClient, tasks: T[]): Promise<T[]> {
  if (tasks.length === 0) return tasks

  const ids = tasks.map((t) => t.id)
  const { data } = await supabase.from('task_tags').select('task_id, tag:tags(id, name, created_by, created_at)').in('task_id', ids)

  const rows = (data ?? []) as unknown as { task_id: string; tag: { id: string; name: string; created_by: string | null; created_at: string } | null }[]

  const tagsByTask = new Map<string, { id: string; name: string; created_by: string | null; created_at: string }[]>()
  rows.forEach((r) => {
    if (!r.tag) return
    const list = tagsByTask.get(r.task_id) ?? []
    list.push(r.tag)
    tagsByTask.set(r.task_id, list)
  })

  return tasks.map((t) => ({ ...t, tags: tagsByTask.get(t.id) ?? [] }))
}

export async function findOrCreateTag(supabase: SupabaseClient, rawName: string, employeeId: string) {
  const name = rawName.trim()
  if (!name) throw new Error('Пустое название тега')

  const { data: existing } = await supabase.from('tags').select('*').ilike('name', name).maybeSingle()
  if (existing) return existing

  const { data: created, error } = await supabase.from('tags').insert({ name, created_by: employeeId }).select().single()
  if (!error) return created

  // Гонка: кто-то успел создать такой же тег между select и insert.
  const { data: retry } = await supabase.from('tags').select('*').ilike('name', name).maybeSingle()
  if (retry) return retry

  throw new Error(error.message)
}

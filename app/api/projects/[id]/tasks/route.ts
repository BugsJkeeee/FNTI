import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo, filterVisibleTasks } from '@/lib/tags'
import type { Task } from '@/types'

// Задачи, привязанные к проекту — для секции «Задачи» на странице проекта.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select(
      '*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization)'
    )
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withComments = await attachCommentInfo(supabase, (data as Task[]) ?? [], employee.id)
  const withTags = await attachTagInfo(supabase, withComments)
  return NextResponse.json(filterVisibleTasks(withTags, employee.id))
}

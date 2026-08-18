import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachCommentInfo } from '@/lib/comments'
import { attachTagInfo, filterVisibleTasks } from '@/lib/tags'
import type { Task } from '@/types'

export async function GET() {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*, author:employees!tasks_author_id_fkey(id, name, specialization), assignee:employees!tasks_assignee_id_fkey(id, name, specialization)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withComments = await attachCommentInfo(supabase, (data as Task[]) ?? [], employee.id)
  const withTags = await attachTagInfo(supabase, withComments)
  return NextResponse.json(filterVisibleTasks(withTags, employee.id))
}

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      text: body.text,
      description: body.description ?? null,
      original_text: body.original_text ?? body.text,
      author_id: employee.id,
      assignee_id: body.assignee_id,
      deadline: body.deadline,
      priority: body.priority,
      ai_explanation: body.ai_explanation ?? null,
      status: 'новая',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('task_history').insert({
    task_id: data.id,
    changed_by: employee.id,
    change_description: 'Задача создана',
  })

  return NextResponse.json(data)
}

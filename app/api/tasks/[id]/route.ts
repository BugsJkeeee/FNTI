import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data: task } = await supabase.from('tasks').select('author_id, assignee_id').eq('id', id).single()
  if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })

  const isAuthor = task.author_id === employee.id
  const isAssignee = task.assignee_id === employee.id
  const body = await req.json()
  const requestedFields = Object.keys(body)
  const onlyStatusChange = requestedFields.length === 1 && requestedFields[0] === 'status'

  if (onlyStatusChange) {
    if (!isAssignee) {
      return NextResponse.json({ error: 'Менять статус может только исполнитель' }, { status: 403 })
    }
  } else if (!isAuthor && !isAssignee) {
    return NextResponse.json({ error: 'Редактировать может только автор или исполнитель' }, { status: 403 })
  }

  const allowedFields = ['text', 'description', 'assignee_id', 'deadline', 'priority', 'status']
  const updates: Record<string, unknown> = {}
  allowedFields.forEach((key) => {
    if (key in body) updates[key] = body[key]
  })

  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('task_history').insert({
    task_id: id,
    changed_by: employee.id,
    change_description: `Изменено: ${Object.keys(updates).join(', ')}`,
  })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data: task } = await supabase.from('tasks').select('author_id, assignee_id').eq('id', id).single()
  if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })

  const canDelete = task.author_id === employee.id || task.assignee_id === employee.id
  if (!canDelete) {
    return NextResponse.json({ error: 'Удалить может только автор или исполнитель' }, { status: 403 })
  }

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

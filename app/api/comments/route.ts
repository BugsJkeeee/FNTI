import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { task_id, text } = await req.json()
  if (!task_id || !text?.trim()) {
    return NextResponse.json({ error: 'Нужен текст комментария' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id, author_id: employee.id, text: text.trim() })
    .select('*, author:employees(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('task_history').insert({
    task_id,
    changed_by: employee.id,
    change_description: 'Добавлен комментарий',
  })

  return NextResponse.json(data)
}

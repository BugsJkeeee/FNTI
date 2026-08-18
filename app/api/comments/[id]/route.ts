import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data: comment } = await supabase.from('task_comments').select('author_id').eq('id', id).single()
  if (!comment) return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 })

  if (comment.author_id !== employee.id) {
    return NextResponse.json({ error: 'Удалить можно только свой комментарий' }, { status: 403 })
  }

  const { error } = await supabase.from('task_comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

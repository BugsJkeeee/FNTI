import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if ('title' in body) updates.title = body.title
  if ('target_date' in body) updates.target_date = body.target_date || null
  if ('comment' in body) updates.comment = body.comment

  // done_by/done_at всегда с сервера — никогда из тела запроса, тот же
  // принцип, что и у is_owner/email в employees.
  if ('done' in body) {
    updates.done = !!body.done
    updates.done_at = body.done ? new Date().toISOString() : null
    updates.done_by = body.done ? employee.id : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нечего сохранять' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_checklist_items').update(updates).eq('id', itemId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase.from('project_checklist_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

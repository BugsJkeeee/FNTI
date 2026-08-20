import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

const HEADER_FIELDS = [
  'lot_label',
  'code',
  'tech_direction',
  'topic',
  'executor_short',
  'executor_full',
  'executor_inn',
  'executor_kpp',
  'executor_address',
  'protocol_number',
  'protocol_date',
  'status',
] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const key of HEADER_FIELDS) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нечего сохранять' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('created_by').eq('id', id).single()
  if (!project) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })

  if (project.created_by !== employee.id && !employee.is_owner) {
    return NextResponse.json({ error: 'Удалить проект может только его создатель или владелец' }, { status: 403 })
  }

  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

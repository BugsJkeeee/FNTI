import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

const STAGE_FIELDS = ['name', 'start_date', 'end_date', 'cost', 'technical_summary', 'financial_summary'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const key of STAGE_FIELDS) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нечего сохранять' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_stages').update(updates).eq('id', stageId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase.from('project_stages').delete().eq('id', stageId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { pickRidFields } from '@/lib/rid-fields'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ridId: string }> }) {
  const { ridId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const updates = pickRidFields(body, true)
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Нечего сохранять' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_rids').update(updates).eq('id', ridId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ ridId: string }> }) {
  const { ridId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase.from('project_rids').delete().eq('id', ridId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

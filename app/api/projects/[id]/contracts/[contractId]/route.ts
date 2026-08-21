import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; contractId: string }> }) {
  const { contractId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  if (body.akr && !/^\d{1,8}$/.test(body.akr)) {
    return NextResponse.json({ error: 'АКР — только цифры, не более 8' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('akr' in body) updates.akr = body.akr

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нечего сохранять' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_contracts').update(updates).eq('id', contractId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

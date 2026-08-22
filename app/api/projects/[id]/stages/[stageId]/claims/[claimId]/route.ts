import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

const CLAIM_FIELDS = ['claim_date', 'claim_number', 'claim_balance', 'claim_misuse_amount', 'claim_noncompliance_amount', 'claim_execution_date', 'claim_execution_payments'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const key of CLAIM_FIELDS) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нечего сохранять' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_claims').update(updates).eq('id', claimId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase.from('project_claims').delete().eq('id', claimId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

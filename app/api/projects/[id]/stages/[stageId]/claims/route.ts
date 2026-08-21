import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

const CLAIM_FIELDS = ['claim_date', 'claim_number', 'claim_balance', 'claim_misuse_amount', 'claim_noncompliance_amount', 'claim_execution_date'] as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const insert: Record<string, unknown> = { stage_id: stageId }
  for (const key of CLAIM_FIELDS) {
    if (key in body) insert[key] = body[key]
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_claims').insert(insert).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

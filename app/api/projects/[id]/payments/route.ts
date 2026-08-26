import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  if (!body.plan_year) {
    return NextResponse.json({ error: 'Нужен год' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('project_payments')
    .insert({
      project_id: id,
      plan_year: body.plan_year,
      contract_number: body.contract_number ?? '',
      obligation_amount: body.obligation_amount ?? null,
      // Факт добавляется отдельно после — платёж создаётся как план, без суммы/даты доведения.
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

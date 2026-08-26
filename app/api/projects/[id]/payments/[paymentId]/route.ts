import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if ('obligation_amount' in body) updates.obligation_amount = body.obligation_amount
  if ('contract_number' in body) updates.contract_number = body.contract_number
  if ('comment' in body) updates.comment = body.comment

  // Факт не принимаем напрямую от клиента — только список платежей, сумма и признак
  // "доведено" считаются здесь же, честно, а не со слов клиента (как is_owner/email у employees).
  if ('payment_events' in body) {
    const events = (Array.isArray(body.payment_events) ? body.payment_events : []) as { date: string | null; amount: number }[]
    const clean = events
      .filter((e) => e.date || e.amount)
      .map((e) => ({ date: e.date || null, amount: Number(e.amount) || 0 }))
    const total = clean.reduce((s, e) => s + e.amount, 0)
    const lastDate = [...clean].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).at(-1)?.date ?? null
    updates.payment_events = clean
    updates.paid_amount = total
    updates.actually_paid = clean.length > 0
    updates.payment_request_date = lastDate
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нечего сохранять' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_payments').update(updates).eq('id', paymentId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase.from('project_payments').delete().eq('id', paymentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

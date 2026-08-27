import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

// "Добавить платёж" здесь означает: зафиксировать реальный перевод денег получателю —
// по какому договору, сколько и когда. Это НЕ то же самое, что план/обязательство (План
// проставляется отдельно, при первичном заведении года — сейчас только импортом). Год в
// таблице считается от даты платежа, а не вводится руками — так его нельзя перепутать с
// годом обязательства. Если на этот договор+год уже есть строка (обычно есть — план на
// год уже существует), платёж добавляется в её payment_events; если нет — строка
// создаётся с обязательством null (плана на этот год ещё не заводили).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const contractNumber = (body.contract_number ?? '').trim()
  const amount = Number(body.amount)
  const date = (body.date ?? '').trim()

  if (!contractNumber) return NextResponse.json({ error: 'Нужен договор' }, { status: 400 })
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Нужна дата платежа' }, { status: 400 })
  if (!amount || amount <= 0) return NextResponse.json({ error: 'Нужна сумма платежа' }, { status: 400 })

  const planYear = Number(date.slice(0, 4))
  const supabase = await createClient()

  const { data: existing, error: findErr } = await supabase
    .from('project_payments')
    .select('id, payment_events')
    .eq('project_id', id)
    .eq('contract_number', contractNumber)
    .eq('plan_year', planYear)
    .maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

  const events = [...((existing?.payment_events as { date: string | null; amount: number }[]) ?? []), { date, amount }]
  const total = events.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const lastDate = [...events].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).at(-1)?.date ?? null

  if (existing) {
    const { data, error } = await supabase
      .from('project_payments')
      .update({ payment_events: events, paid_amount: total, actually_paid: true, payment_request_date: lastDate })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('project_payments')
    .insert({
      project_id: id,
      plan_year: planYear,
      contract_number: contractNumber,
      obligation_amount: null,
      payment_events: events,
      paid_amount: total,
      actually_paid: true,
      payment_request_date: lastDate,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

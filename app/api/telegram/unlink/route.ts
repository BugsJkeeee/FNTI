import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function POST() {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('employees')
    .update({ telegram_chat_id: null, telegram_link_code: null })
    .eq('id', employee.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

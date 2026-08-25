import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

// Лёгкий список проектов для селектора «Проект» при постановке задачи — без вложенных
// этапов/чек-листов/платежей, которые тянет основной GET /api/projects.
export async function GET() {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, number, wave, code, status')
    .order('wave', { ascending: true })
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

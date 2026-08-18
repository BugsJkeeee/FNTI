import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { findOrCreateTag } from '@/lib/tags'

export async function GET() {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase.from('tags').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { name } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Нужно название тега' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    const tag = await findOrCreateTag(supabase, name, employee.id)
    return NextResponse.json(tag)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Не удалось создать тег' }, { status: 500 })
  }
}

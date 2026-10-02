import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { pickRidFields } from '@/lib/rid-fields'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const fields = pickRidFields(body)
  if (!fields.title || !fields.kind) {
    return NextResponse.json({ error: 'Нужны вид и название РИД' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('project_rids').insert({ project_id: id, ...fields }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}


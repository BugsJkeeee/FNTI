import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'Пустой комментарий' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('project_comments')
    .insert({ project_id: id, author_id: employee.id, text: body.text.trim() })
    .select('*, author:employees(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { attachProjectCommentInfo } from '@/lib/project-comments'
import type { Project } from '@/types'

const SELECT = '*, stages:project_stages(*, checklist_items:project_checklist_items(*)), comments:project_comments(*, author:employees(name))'

export async function GET() {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select(SELECT)
    .order('wave', { ascending: true })
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const withComments = await attachProjectCommentInfo(supabase, (data as Project[]) ?? [], employee.id)
  return NextResponse.json(withComments)
}

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  if (!body.number || !body.wave || !body.code) {
    return NextResponse.json({ error: 'Заполни номер проекта, волну и шифр' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({
      number: body.number,
      wave: body.wave,
      lot_label: body.lot_label ?? '',
      code: body.code,
      tech_direction: body.tech_direction ?? '',
      topic: body.topic ?? '',
      executor_short: body.executor_short ?? '',
      executor_full: body.executor_full ?? '',
      executor_inn: body.executor_inn ?? '',
      executor_kpp: body.executor_kpp ?? '',
      executor_address: body.executor_address ?? '',
      created_by: employee.id,
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

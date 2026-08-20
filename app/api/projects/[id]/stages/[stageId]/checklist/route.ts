import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function POST(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  if (!body.title || (body.track !== 'technical' && body.track !== 'financial')) {
    return NextResponse.json({ error: 'Нужны title и track (technical/financial)' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('project_checklist_items')
    .select('step_order')
    .eq('stage_id', stageId)
    .eq('track', body.track)
  const nextOrder = (existing ?? []).reduce((max, r) => Math.max(max, r.step_order), 0) + 1

  const { data, error } = await supabase
    .from('project_checklist_items')
    .insert({
      stage_id: stageId,
      track: body.track,
      step_order: nextOrder,
      template_key: null,
      is_default: false,
      title: body.title,
      target_date: body.target_date || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

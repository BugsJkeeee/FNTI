import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { buildChecklistRows } from '@/lib/project-checklist-templates'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const supabase = await createClient()

  const { data: existingStages } = await supabase.from('project_stages').select('stage_number').eq('project_id', id)
  const nextStageNumber = (existingStages ?? []).reduce((max, s) => Math.max(max, s.stage_number), 0) + 1

  const { data: stage, error: stageError } = await supabase
    .from('project_stages')
    .insert({
      project_id: id,
      stage_number: nextStageNumber,
      name: body.name ?? '',
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      cost: body.cost || null,
    })
    .select()
    .single()

  if (stageError) return NextResponse.json({ error: stageError.message }, { status: 500 })

  const rows = buildChecklistRows({ end_date: stage.end_date }).map((row) => ({
    stage_id: stage.id,
    track: row.track,
    step_order: row.step_order,
    template_key: row.template_key,
    is_default: true,
    title: row.title,
    target_date: row.target_date,
  }))

  const { data: checklistItems, error: checklistError } = await supabase
    .from('project_checklist_items')
    .insert(rows)
    .select()

  if (checklistError) return NextResponse.json({ error: checklistError.message }, { status: 500 })

  return NextResponse.json({ stage: { ...stage, checklist_items: checklistItems } })
}

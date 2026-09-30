import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  if (!body.contract_number) {
    return NextResponse.json({ error: 'Нужен номер договора' }, { status: 400 })
  }
  if (body.akr && !/^\d{1,8}$/.test(body.akr)) {
    return NextResponse.json({ error: 'АКР — только цифры, не более 8' }, { status: 400 })
  }

  const supabase = await createClient()

  // Автоподстановка реквизитов ГРБС по направлению проекта — одно решение действует на
  // все проекты направления в этом году (см. direction_grbs_decisions на Глоссарии).
  // Молча пропускаем, если для этого направления/года решение ещё не занесено — сотрудник
  // впишет вручную, когда появится.
  let grbs: Partial<{
    subsidy_ministry: string
    subsidy_agreement_number: string
    subsidy_agreement_date: string | null
    subsidy_decision_number: string
    subsidy_decision_date: string | null
    subsidy_identifier: string
  }> = {}
  if (body.contract_year) {
    const { data: project } = await supabase.from('projects').select('tech_direction').eq('id', id).single()
    if (project?.tech_direction) {
      const { data: decision } = await supabase
        .from('direction_grbs_decisions')
        .select('*')
        .eq('tech_direction', project.tech_direction)
        .eq('year', body.contract_year)
        .maybeSingle()
      if (decision) {
        grbs = {
          subsidy_ministry: decision.subsidy_ministry,
          subsidy_agreement_number: decision.subsidy_agreement_number,
          subsidy_agreement_date: decision.subsidy_agreement_date,
          subsidy_decision_number: decision.subsidy_decision_number,
          subsidy_decision_date: decision.subsidy_decision_date,
          subsidy_identifier: decision.subsidy_identifier,
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('project_contracts')
    .insert({
      project_id: id,
      contract_number: body.contract_number,
      contract_date: body.contract_date || null,
      contract_year: body.contract_year || null,
      stage_number: body.stage_number || null,
      akr: body.akr ?? '',
      ...grbs,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

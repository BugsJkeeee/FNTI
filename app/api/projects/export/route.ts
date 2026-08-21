import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { currentStageOf, trackStatus } from '@/lib/project-status'
import type { Project } from '@/types'

const SELECT = '*, stages:project_stages(*, checklist_items:project_checklist_items(*)), contracts:project_contracts(*), comments:project_comments(*, author:employees(name))'

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Действующий',
  terminating: 'Прекращаем',
  terminated: 'Прекращён',
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : ''
}

function sortedContracts(project: Project) {
  return [...(project.contracts ?? [])].sort((a, b) => {
    const aKey = a.stage_number ?? a.contract_year ?? 0
    const bKey = b.stage_number ?? b.contract_year ?? 0
    if (aKey !== bKey) return aKey - bKey
    return (a.contract_date ?? '').localeCompare(b.contract_date ?? '')
  })
}

function latestCommentText(project: Project) {
  const comments = [...(project.comments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const c = comments[0]
  return c ? `«${c.text}» — ${c.author?.name ?? ''}` : ''
}

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

  const projects = (data as Project[]) ?? []

  const maxContracts = projects.reduce((max, p) => Math.max(max, (p.contracts ?? []).length), 0)
  const maxStages = projects.reduce((max, p) => Math.max(max, (p.stages ?? []).length), 0)

  const rows = projects.map((p) => {
    const stage = currentStageOf(p)
    const tech = trackStatus(stage, 'technical')
    const fin = trackStatus(stage, 'financial')
    const contracts = sortedContracts(p)
    const stages = [...(p.stages ?? [])].sort((a, b) => a.stage_number - b.stage_number)

    const contractColumns: Record<string, string> = {}
    for (let i = 0; i < maxContracts; i++) {
      const c = contracts[i]
      contractColumns[`Договор ${i + 1} — номер`] = c?.contract_number ?? ''
      contractColumns[`Договор ${i + 1} — дата`] = formatDate(c?.contract_date ?? null)
      contractColumns[`Договор ${i + 1} — АКР`] = c?.akr ?? ''
    }

    const stageColumns: Record<string, string | number> = {}
    for (let i = 0; i < maxStages; i++) {
      const s = stages[i]
      stageColumns[`Этап ${i + 1} — начало`] = formatDate(s?.start_date ?? null)
      stageColumns[`Этап ${i + 1} — окончание`] = formatDate(s?.end_date ?? null)
      stageColumns[`Этап ${i + 1} — сумма, ₽`] = s?.cost ?? ''
    }

    return {
      'ID проекта': p.number,
      'Волна': p.wave,
      'Шифр': p.code,
      'Статус проекта': STATUS_LABEL[p.status],
      'Тема НИОКР': p.topic,
      'Технологическое направление': p.tech_direction,
      'Исполнитель (кратко)': p.executor_short,
      'Исполнитель (полное наименование)': p.executor_full,
      'ИНН': p.executor_inn,
      'КПП': p.executor_kpp,
      'Адрес': p.executor_address,
      'Протокол №': p.protocol_number,
      'Дата протокола': formatDate(p.protocol_date),
      ...contractColumns,
      ...stageColumns,
      'Текущий этап': stage ? stage.stage_number : '',
      'Статус технической экспертизы': tech.text,
      'Статус финансовой экспертизы': fin.text,
      'Мнение Фонда НТИ': latestCommentText(p),
    }
  })

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = Object.keys(rows[0] ?? {}).map((key) => ({ wch: Math.min(Math.max(key.length, 12), 45) }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Проекты')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="projects-${new Date().toLocaleDateString('en-CA')}.xlsx"`,
    },
  })
}

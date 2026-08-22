import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/telegram'
import type { Task } from '@/types'
import { isStageClosed } from '@/lib/project-checklist-templates'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function dateHeader(deadline: string, today: string, tomorrow: string) {
  if (deadline < today) return `⚠️ Просрочено (${new Date(deadline).toLocaleDateString('ru-RU')})`
  if (deadline === today) return '📌 Сегодня'
  if (deadline === tomorrow) return '🗓 Завтра'
  return new Date(deadline).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTask(t: Task) {
  return `• [${t.priority}] ${t.text}`
}

// Дайджест по проектам НИОКР — в отличие от задач, у проектов нет "исполнителя",
// поэтому текст один и тот же для всех, кому пришлют (в отличие от task-дайджеста,
// который у каждого сотрудника свой по его задачам).
async function buildProjectDigestText(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const today = todayISO()
  const weekEnd = addDaysISO(7)
  const tomorrow = addDaysISO(1)

  const { data: projects } = await admin
    .from('projects')
    .select(
      'id, number, code, stages:project_stages(id, stage_number, end_date, checklist_items:project_checklist_items(template_key, title, target_date, done, track), claims:project_claims(id, claim_number, claim_execution_date))'
    )
    .neq('status', 'terminated')
    .order('number', { ascending: true })

  type ChecklistItemRow = { template_key: string | null; title: string; target_date: string | null; done: boolean; track: string }
  type ClaimRow = { id: string; claim_number: string; claim_execution_date: string | null }
  type StageRow = { id: string; stage_number: number; end_date: string | null; checklist_items: ChecklistItemRow[]; claims: ClaimRow[] }
  type ProjectRow = { id: string; number: number; code: string; stages: StageRow[] }

  const projectList = (projects as unknown as ProjectRow[]) ?? []

  const stagesDue: string[] = []
  const stepsDue: string[] = []
  const openClaims: string[] = []

  for (const p of projectList) {
    for (const s of p.stages) {
      if (s.end_date && s.end_date >= today && s.end_date <= weekEnd) {
        stagesDue.push(`• №${p.number} ${p.code}, этап ${s.stage_number} — ${dateHeader(s.end_date, today, tomorrow)}`)
      }
      // Только текущий (не закрытый) этап — по закрытым шагам напоминать бессмысленно.
      if (!isStageClosed(s.checklist_items)) {
        for (const item of s.checklist_items) {
          if (!item.done && item.target_date && item.target_date >= today && item.target_date <= weekEnd) {
            stepsDue.push(`• №${p.number} ${p.code}, этап ${s.stage_number}: «${item.title}» — ${dateHeader(item.target_date, today, tomorrow)}`)
          }
        }
      }
      for (const claim of s.claims) {
        if (!claim.claim_execution_date) {
          openClaims.push(`• №${p.number} ${p.code}, этап ${s.stage_number}${claim.claim_number ? `, № ${claim.claim_number}` : ''}`)
        }
      }
    }
  }

  if (stagesDue.length === 0 && stepsDue.length === 0 && openClaims.length === 0) return null

  const parts: string[] = ['📁 Дайджест по проектам НИОКР']

  if (stagesDue.length > 0) {
    parts.push('\nОкончание этапа на этой неделе:', ...stagesDue)
  }
  if (stepsDue.length > 0) {
    parts.push('\nШаги чек-листа с истекающим сроком:', ...stepsDue)
  }
  if (openClaims.length > 0) {
    parts.push('\nОткрытые требования о возврате (без даты исполнения):', ...openClaims)
  }

  return parts.join('\n')
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const providedSecret = auth?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret')
  if (providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: employees } = await admin
    .from('employees')
    .select('id, name, telegram_chat_id')
    .not('telegram_chat_id', 'is', null)

  if (!employees || employees.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const today = todayISO()
  const tomorrow = addDaysISO(1)
  const weekEnd = addDaysISO(7)

  let sent = 0

  for (const employee of employees) {
    const { data: tasks } = await admin
      .from('tasks')
      .select('*')
      .eq('assignee_id', employee.id)
      .neq('status', 'выполнена')
      .lte('deadline', weekEnd)
      .order('deadline', { ascending: true })

    const activeTasks = (tasks as Task[]) ?? []
    if (activeTasks.length === 0) continue

    const parts: string[] = [`Доброе утро, ${employee.name}! Вот твой дайджест задач по возрастанию срока.`]

    let currentGroup: string | null = null
    for (const task of activeTasks) {
      if (!task.deadline) continue
      if (task.deadline !== currentGroup) {
        currentGroup = task.deadline
        parts.push(`\n${dateHeader(task.deadline, today, tomorrow)}:`)
      }
      parts.push(formatTask(task))
    }

    await sendMessage(employee.telegram_chat_id as number, parts.join('\n'))
    sent += 1
  }

  // Дайджест по проектам — отдельным сообщением, один и тот же текст всем, у кого привязан Telegram.
  let projectDigestSent = 0
  const projectDigestText = await buildProjectDigestText(admin)
  if (projectDigestText) {
    for (const employee of employees) {
      await sendMessage(employee.telegram_chat_id as number, projectDigestText)
      projectDigestSent += 1
    }
  }

  return NextResponse.json({ sent, projectDigestSent })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/telegram'
import type { Task } from '@/types'

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

  return NextResponse.json({ sent })
}

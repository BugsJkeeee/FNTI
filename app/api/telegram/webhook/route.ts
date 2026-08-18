import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const update = await req.json()
  const message = update.message
  const chatId: number | undefined = message?.chat?.id
  const text: string | undefined = message?.text

  if (chatId && text?.startsWith('/start')) {
    const code = text.replace('/start', '').trim()
    const admin = createAdminClient()

    if (!code) {
      await sendMessage(chatId, 'Пришли команду вместе с кодом привязки из личного кабинета: /start <код>')
      return NextResponse.json({ ok: true })
    }

    const { data: employee } = await admin
      .from('employees')
      .select('id, name')
      .eq('telegram_link_code', code)
      .maybeSingle()

    if (!employee) {
      await sendMessage(chatId, 'Код не найден или уже использован. Получи новый в личном кабинете на сайте.')
      return NextResponse.json({ ok: true })
    }

    await admin
      .from('employees')
      .update({ telegram_chat_id: chatId, telegram_link_code: null })
      .eq('id', employee.id)

    await sendMessage(chatId, `Готово, ${employee.name}! Telegram привязан — теперь сюда будет приходить дайджест задач.`)
  }

  return NextResponse.json({ ok: true })
}

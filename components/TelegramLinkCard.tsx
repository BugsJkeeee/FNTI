'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee } from '@/types'

export default function TelegramLinkCard({ employee }: { employee: Employee }) {
  const router = useRouter()
  const [code, setCode] = useState<string | null>(null)
  const [botUsername, setBotUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGetCode() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/telegram/link-code', { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Не удалось получить код')
      return
    }
    setCode(data.code)
    setBotUsername(data.botUsername)
  }

  async function handleUnlink() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/telegram/unlink', { method: 'POST' })
    setLoading(false)
    if (!res.ok) {
      setError('Не удалось отвязать Telegram')
      return
    }
    router.refresh()
  }

  if (employee.telegram_chat_id) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink">✅ Telegram подключён — сюда приходит утренний дайджест задач.</p>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-urgent hover:text-urgent disabled:opacity-50"
        >
          Отвязать
        </button>
        {error && <p className="text-sm text-urgent">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Привяжи Telegram, чтобы получать утренний дайджест своих задач.</p>
      {!code ? (
        <button
          onClick={handleGetCode}
          disabled={loading}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-teal hover:text-teal disabled:opacity-50"
        >
          {loading ? 'Получаю код…' : 'Получить код'}
        </button>
      ) : (
        <div className="rounded-lg border border-line bg-paper p-3 text-sm">
          <p className="text-ink">
            1. Открой бота{' '}
            {botUsername ? (
              <a
                href={`https://t.me/${botUsername}?start=${code}`}
                target="_blank"
                rel="noreferrer"
                className="text-teal underline"
              >
                @{botUsername}
              </a>
            ) : (
              'команды'
            )}
          </p>
          <p className="mt-1 text-ink">
            2. Или отправь ему вручную: <span className="font-mono">/start {code}</span>
          </p>
        </div>
      )}
      {error && <p className="text-sm text-urgent">{error}</p>}
    </div>
  )
}

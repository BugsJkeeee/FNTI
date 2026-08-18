'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Подписывается на появление новых задач через Supabase Realtime и вызывает
 * onInsert при каждой новой строке в tasks. Приватность соблюдается на уровне
 * RLS (см. supabase-schema-realtime-and-privacy-fix.sql) — событие о чужой
 * задаче с тегом "личное" сюда просто не дойдёт.
 *
 * Колбэк хранится в ref, чтобы не пересоздавать подписку на каждый рендер —
 * подписка живёт одну на весь жизненный цикл компонента.
 */
export function useTaskInserted(onInsert: () => void) {
  const callbackRef = useRef(onInsert)

  useEffect(() => {
    callbackRef.current = onInsert
  }, [onInsert])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    // Supabase Realtime авторизует канал текущим access_token'ом клиента.
    // Если подписаться сразу после createClient(), токен может быть ещё не
    // синхронизирован — канал уходит в статус SUBSCRIBED, но фактически как
    // анонимный, и RLS (auth.role() = 'authenticated') тихо отфильтровывает
    // все события. Дожидаемся сессии явно, прежде чем подписываться.
    supabase.auth.getSession().then(() => {
      if (cancelled) return
      channel = supabase
        .channel(`tasks-insert-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, () => {
          callbackRef.current()
        })
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])
}

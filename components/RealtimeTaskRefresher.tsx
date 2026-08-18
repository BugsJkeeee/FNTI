'use client'

import { useRouter } from 'next/navigation'
import { useTaskInserted } from '@/lib/hooks/useTaskInserted'

/**
 * Невидимый компонент для страниц, которые сами не держат список задач в
 * состоянии (данные приходят готовыми с сервера при каждом рендере) — просто
 * перезапрашивает серверные данные текущего роута, когда кто-то создаёт задачу.
 * Для страниц со своим client-side списком (Доска/Дашборд/Личный кабинет)
 * вместо этого используется useTaskInserted() напрямую — так быстрее.
 */
export default function RealtimeTaskRefresher() {
  const router = useRouter()
  useTaskInserted(() => router.refresh())
  return null
}

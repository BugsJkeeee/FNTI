'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Категорийный мультиселект-фильтр, синхронизированный с URL (?direction=A&direction=B —
 * повторяющиеся параметры, не CSV через запятую: часть направлений сами содержат запятую
 * в названии, "Технологии навигации, радионавигации", CSV-парсинг её бы порезал) — можно
 * поделиться ссылкой с уже применёнными фильтрами. Отсутствие параметра в URL = "выбрано
 * всё" (чистый URL для дефолтного состояния), не пустой список.
 */
export function useMultiSelectParam(paramName: string, allKeys: string[]) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const raw = searchParams.getAll(paramName)
  const selected = raw.length > 0 ? new Set(raw.filter((k) => allKeys.includes(k))) : new Set(allKeys)

  function setParams(next: Set<string>) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(paramName)
    if (next.size !== allKeys.length && next.size !== 0) {
      next.forEach((v) => params.append(paramName, v))
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setParams(next)
  }

  function setOnly(key: string) {
    setParams(new Set([key]))
  }

  return { selected, toggle, setOnly, allSelected: selected.size === allKeys.length }
}

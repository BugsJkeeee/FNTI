import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/types'

// cache() дедуплицирует вызов на весь один HTTP-запрос: без него layout.tsx и
// page.tsx каждый по отдельности бьют в Supabase Auth (auth.getUser() — это
// сетевой запрос, не просто чтение куки) и в таблицу employees.
export const getCurrentEmployee = cache(async (): Promise<Employee | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as Employee | null
})

// Тот же приём для списка сотрудников: раньше каждая страница (+ layout)
// заново выбирала всю таблицу employees на каждый переход — 2 одинаковых
// запроса на один запрос страницы.
export const getAllEmployees = cache(async (): Promise<Employee[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from('employees').select('*').order('name')
  return (data as Employee[]) ?? []
})

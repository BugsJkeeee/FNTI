import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/types'

export async function getCurrentEmployee(): Promise<Employee | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as Employee | null
}

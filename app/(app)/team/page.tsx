import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import AddEmployeeForm from '@/components/AddEmployeeForm'
import type { Employee } from '@/types'

export default async function TeamPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !employee.is_owner) redirect('/board')

  const supabase = await createClient()
  const { data } = await supabase.from('employees').select('*').order('created_at')
  const employees = (data as Employee[]) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Команда</h1>
        <p className="mt-1 text-sm text-ink-soft">Участники, которые видят и получают задачи в системе.</p>
      </div>

      <AddEmployeeForm />

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-base font-semibold text-ink">Все участники</h2>
        <div className="mt-3 divide-y divide-line">
          {employees.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">{e.name}</p>
                <p className="text-xs text-ink-soft">{e.email} · {e.specialization || 'специализация не указана'}</p>
              </div>
              {e.is_owner && (
                <span className="font-mono text-xs text-ink-soft">владелец</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

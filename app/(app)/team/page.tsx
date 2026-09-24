import { redirect } from 'next/navigation'
import { getCurrentEmployee, getAllEmployees } from '@/lib/current-employee'
import AddEmployeeForm from '@/components/AddEmployeeForm'
import EmployeeList from '@/components/EmployeeList'

export default async function TeamPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !employee.is_owner) redirect('/board')

  const allEmployees = await getAllEmployees()
  const employees = [...allEmployees].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Команда</h1>
        <p className="mt-1 text-sm text-ink-soft">Участники, которые видят и получают задачи в системе.</p>
      </div>

      <AddEmployeeForm />

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-base font-semibold text-ink">Все участники</h2>
        <div className="mt-3">
          <EmployeeList employees={employees} currentEmployeeId={employee.id} />
        </div>
      </div>
    </div>
  )
}

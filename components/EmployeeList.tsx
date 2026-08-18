'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee } from '@/types'

export default function EmployeeList({
  employees,
  currentEmployeeId,
}: {
  employees: Employee[]
  currentEmployeeId: string
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(employee: Employee) {
    if (!confirm(`Удалить участника «${employee.name}»? Его задачи останутся в системе без автора/исполнителя. Это необратимо.`)) return

    setDeletingId(employee.id)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Не удалось удалить участника')
        return
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {error && <p className="mb-3 rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>}

      <div className="divide-y divide-line">
        {employees.map((e) => (
          <div key={e.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">{e.name}</p>
              <p className="text-xs text-ink-soft">{e.email} · {e.specialization || 'специализация не указана'}</p>
            </div>
            <div className="flex items-center gap-3">
              {e.is_owner && <span className="font-mono text-xs text-ink-soft">владелец</span>}
              {e.id !== currentEmployeeId && (
                <button
                  onClick={() => handleDelete(e)}
                  disabled={deletingId === e.id}
                  className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-urgent hover:text-urgent disabled:opacity-50"
                >
                  {deletingId === e.id ? 'Удаляю…' : 'Удалить'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

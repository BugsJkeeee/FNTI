'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TaskForm from '@/components/TaskForm'
import type { Employee } from '@/types'

export default function EmployeeQuickCreate({
  employees,
  defaultAssigneeId,
  personName,
}: {
  employees: Employee[]
  defaultAssigneeId: string
  personName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light"
      >
        {open ? 'Скрыть форму' : `+ Поставить задачу для ${personName}`}
      </button>
      {open && (
        <div className="mt-4">
          <TaskForm
            employees={employees}
            defaultAssigneeId={defaultAssigneeId}
            onCreated={() => router.refresh()}
          />
        </div>
      )}
    </div>
  )
}

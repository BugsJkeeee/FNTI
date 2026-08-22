'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Employee, Task } from '@/types'
import { isPrivateTask, isTaskOwner } from '@/lib/tags'

type Row = {
  employee: Employee
  activeTasks: Task[]
  overdueTasks: Task[]
  closedTasks: Task[]
  avgDays: number | null
}

type Selected = { title: string; tasks: Task[] }

function NumberButton({ count, onOpen, urgent }: { count: number; onOpen: () => void; urgent?: boolean }) {
  if (count === 0) {
    return <span className="text-ink-soft">0</span>
  }
  return (
    <button
      onClick={onOpen}
      className={`underline decoration-dotted underline-offset-2 transition hover:text-teal ${
        urgent ? 'font-medium text-urgent' : 'text-ink-soft'
      }`}
    >
      {count}
    </button>
  )
}

export default function AnalyticsTable({
  rows,
  totalActiveTasks,
  totalOverdueTasks,
  currentEmployeeId,
}: {
  rows: Row[]
  totalActiveTasks: Task[]
  totalOverdueTasks: Task[]
  currentEmployeeId: string
}) {
  const [selected, setSelected] = useState<Selected | null>(null)

  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-white p-4 text-center">
          <button
            onClick={() => setSelected({ title: 'Активные задачи команды', tasks: totalActiveTasks })}
            disabled={totalActiveTasks.length === 0}
            className="font-display text-2xl font-semibold text-ink transition hover:text-teal disabled:hover:text-ink"
          >
            {totalActiveTasks.length}
          </button>
          <p className="mt-0.5 text-xs text-ink-soft">активных задач в команде</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 text-center">
          <button
            onClick={() => setSelected({ title: 'Просроченные задачи команды', tasks: totalOverdueTasks })}
            disabled={totalOverdueTasks.length === 0}
            className="font-display text-2xl font-semibold text-urgent transition hover:opacity-70 disabled:hover:opacity-100"
          >
            {totalOverdueTasks.length}
          </button>
          <p className="mt-0.5 text-xs text-ink-soft">просрочено сейчас</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-left text-xs text-ink-soft">
              <th className="px-4 py-2.5 font-medium">Участник</th>
              <th className="px-4 py-2.5 font-medium">Активных</th>
              <th className="px-4 py-2.5 font-medium">Выполненных</th>
              <th className="px-4 py-2.5 font-medium">Просрочено</th>
              <th className="px-4 py-2.5 font-medium">Ср. дней на закрытие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee, activeTasks, closedTasks, overdueTasks, avgDays }) => (
              <tr key={employee.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink">{employee.name}</td>
                <td className="px-4 py-2.5">
                  <NumberButton
                    count={activeTasks.length}
                    onOpen={() => setSelected({ title: `${employee.name} — активные задачи`, tasks: activeTasks })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <NumberButton
                    count={closedTasks.length}
                    onOpen={() => setSelected({ title: `${employee.name} — выполненные задачи`, tasks: closedTasks })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <NumberButton
                    count={overdueTasks.length}
                    urgent={overdueTasks.length > 0}
                    onOpen={() => setSelected({ title: `${employee.name} — просроченные задачи`, tasks: overdueTasks })}
                  />
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{avgDays ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              {selected.title} ({selected.tasks.length})
            </h3>
            <button onClick={() => setSelected(null)} className="text-xs text-ink-soft hover:text-ink">
              Закрыть ✕
            </button>
          </div>
          <div className="mt-2 divide-y divide-line">
            {selected.tasks.map((t) => {
              const hidden = isPrivateTask(t) && !isTaskOwner(t, currentEmployeeId)
              if (hidden) {
                return (
                  <div key={t.id} className="flex cursor-not-allowed items-center gap-1.5 py-2 text-sm text-ink-soft opacity-60">
                    🔒 Личная задача
                  </div>
                )
              }
              return (
                <Link key={t.id} href={`/tasks/${t.id}?from=analytics`} className="block py-2 text-sm text-ink transition hover:text-teal">
                  <span className="font-mono text-xs text-ink-soft">#{t.number}</span> {t.text}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

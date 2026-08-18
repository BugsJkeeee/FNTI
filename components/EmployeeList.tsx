'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Employee } from '@/types'

function EditEmployeeForm({ employee, onCancel, onSaved }: { employee: Employee; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(employee.name)
  const [email, setEmail] = useState(employee.email)
  const [password, setPassword] = useState('')
  const [specialization, setSpecialization] = useState(employee.specialization ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: password || undefined, specialization }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Не удалось сохранить изменения')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 py-2.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Имя</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Новый пароль</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="оставь пустым, чтобы не менять"
            minLength={6}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Специализация</label>
          <input
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="например: продажи, дизайн"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
      </div>

      {error && <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft hover:text-ink"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}

export default function EmployeeList({
  employees,
  currentEmployeeId,
}: {
  employees: Employee[]
  currentEmployeeId: string
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
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
        {employees.map((e) =>
          editingId === e.id ? (
            <EditEmployeeForm
              key={e.id}
              employee={e}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null)
                router.refresh()
              }}
            />
          ) : (
            <div key={e.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">{e.name}</p>
                <p className="text-xs text-ink-soft">{e.email} · {e.specialization || 'специализация не указана'}</p>
              </div>
              <div className="flex items-center gap-3">
                {e.is_owner && <span className="font-mono text-xs text-ink-soft">владелец</span>}
                <button
                  onClick={() => setEditingId(e.id)}
                  className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-teal hover:text-teal"
                >
                  Редактировать
                </button>
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
          )
        )}
      </div>
    </div>
  )
}

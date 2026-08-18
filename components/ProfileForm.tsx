'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/types'

export default function ProfileForm({ employee }: { employee: Employee }) {
  const router = useRouter()
  const [specialization, setSpecialization] = useState(employee.specialization ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [savingSpec, setSavingSpec] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSaveSpecialization(e: React.FormEvent) {
    e.preventDefault()
    setSavingSpec(true)
    setMessage(null)
    const supabase = createClient()
    const { error } = await supabase.from('employees').update({ specialization }).eq('id', employee.id)
    setSavingSpec(false)
    setMessage(error ? 'Не удалось сохранить специализацию' : 'Специализация обновлена')
    router.refresh()
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setMessage('Пароль должен быть не короче 6 символов')
      return
    }
    setSavingPassword(true)
    setMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    setNewPassword('')
    setMessage(error ? 'Не удалось сменить пароль' : 'Пароль изменён')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSaveSpecialization} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-ink-soft">Специализация</label>
          <input
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="например: продажи, дизайн"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <button
          type="submit"
          disabled={savingSpec}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-teal hover:text-teal disabled:opacity-50"
        >
          Сохранить
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-ink-soft">Новый пароль</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>
        <button
          type="submit"
          disabled={savingPassword}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-teal hover:text-teal disabled:opacity-50"
        >
          Сменить
        </button>
      </form>

      {message && <p className="text-sm text-ink-soft">{message}</p>}
    </div>
  )
}

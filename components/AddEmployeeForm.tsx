'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddEmployeeForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, specialization }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Не удалось добавить участника')
      setLoading(false)
      return
    }

    setName('')
    setEmail('')
    setPassword('')
    setSpecialization('')
    setSuccess(true)
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Добавить участника</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Придумай временный пароль и передай его лично — участник сможет сменить его в своём профиле.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <label className="mb-1 block text-xs font-medium text-ink-soft">Временный пароль</label>
          <input
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

      {error && <p className="mt-3 rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>}
      {success && <p className="mt-3 rounded-lg bg-low-soft px-3 py-2 text-sm text-done">Участник добавлен.</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-lg bg-graphite px-4 py-2 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
      >
        {loading ? 'Добавляю…' : 'Добавить участника'}
      </button>
    </form>
  )
}

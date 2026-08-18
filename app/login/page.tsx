'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Не удалось войти. Проверь email и пароль.')
      setLoading(false)
      return
    }

    router.push('/board')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-graphite flex items-center justify-center">
            <span className="font-display font-semibold text-paper text-sm">З</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Задачи команды</h1>
          <p className="mt-1 text-sm text-ink-soft">Войди, чтобы увидеть свою доску</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-graphite py-2.5 text-sm font-medium text-paper transition hover:bg-graphite-light disabled:opacity-50"
          >
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-soft">
          Нет доступа? Обратись к своему менеджеру — он добавит тебя в систему.
        </p>
      </div>
    </main>
  )
}

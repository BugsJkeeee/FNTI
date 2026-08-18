import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/current-employee'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import AiCommandMenu from '@/components/AiCommandMenu'
import type { Employee } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const supabase = await createClient()
  const { data: employees } = await supabase.from('employees').select('*').order('name')
  const allEmployees = (employees as Employee[]) ?? []

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/board" className="font-display text-lg font-semibold text-ink">
                Задачи команды
              </Link>
              <nav className="flex gap-1 whitespace-nowrap">
                <Link href="/board" className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                  Доска
                </Link>
                <Link href="/me" className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                  Личный кабинет
                </Link>
                <Link href="/calendar" className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                  Календарь
                </Link>
                <Link href="/analytics" className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                  Аналитика
                </Link>
                <Link href="/glossary" className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                  Глоссарий
                </Link>
                {employee.is_owner && (
                  <Link href="/team" className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink">
                    Команда
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-ink">{employee.name}</p>
                <p className="font-mono text-xs text-ink-soft">{employee.specialization || '—'}</p>
              </div>
              <AiCommandMenu />
              <SignOutButton />
            </div>
          </div>

          {/* Иконки-ссылки на страницы участников */}
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <span className="mr-1 font-mono text-xs text-ink-soft">Команда:</span>
            {allEmployees.map((e) => (
              <Link
                key={e.id}
                href={`/employee/${e.id}`}
                className="rounded-full bg-graphite px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-graphite-light"
              >
                {e.name}
              </Link>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}

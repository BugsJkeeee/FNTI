'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-soft hover:text-ink"
    >
      Выйти
    </button>
  )
}

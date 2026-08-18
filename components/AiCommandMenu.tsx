'use client'

import { useState } from 'react'
import AiCommandBox from '@/components/AiCommandBox'

export default function AiCommandMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Команда ИИ"
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
          open ? 'border-teal bg-teal-soft text-teal' : 'border-line text-ink-soft hover:border-teal hover:text-teal'
        }`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
          <path d="M9.5 2a.75.75 0 0 1 .696.471l1.185 2.963 2.963 1.185a.75.75 0 0 1 0 1.393l-2.963 1.185-1.185 2.963a.75.75 0 0 1-1.393 0L7.618 9.197 4.655 8.012a.75.75 0 0 1 0-1.393l2.963-1.185L8.803 2.47A.75.75 0 0 1 9.5 2Z" />
          <path d="M16.5 11a.75.75 0 0 1 .696.471l.612 1.53 1.53.612a.75.75 0 0 1 0 1.393l-1.53.612-.612 1.53a.75.75 0 0 1-1.393 0l-.612-1.53-1.53-.612a.75.75 0 0 1 0-1.393l1.53-.612.612-1.53A.75.75 0 0 1 16.5 11Z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 top-[4.5rem] z-50 px-4">
            <div className="mx-auto max-w-7xl">
              <AiCommandBox />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

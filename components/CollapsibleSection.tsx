'use client'

import { useState } from 'react'

export default function CollapsibleSection({
  title,
  description,
  defaultOpen,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
        </div>
        <span className="shrink-0 text-xs text-ink-soft">{open ? 'Свернуть' : 'Развернуть'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

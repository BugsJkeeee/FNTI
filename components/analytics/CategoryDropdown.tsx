'use client'

import { useState } from 'react'
import { ChevronDownIcon } from './icons'

export type FilterOption = { key: string; label: string; count: number }

export default function CategoryDropdown({
  label,
  options,
  selected,
  onToggle,
  allSelected,
}: {
  label: string
  options: FilterOption[]
  selected: Set<string>
  onToggle: (key: string) => void
  allSelected: boolean
}) {
  const [open, setOpen] = useState(false)
  const selectedCount = options.filter((o) => selected.has(o.key)).length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
          allSelected ? 'border-line text-ink-soft hover:border-teal' : 'border-teal bg-teal-soft text-teal'
        }`}
      >
        {label}: {allSelected ? 'все' : `${selectedCount} из ${options.length}`}
        <ChevronDownIcon className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-line bg-white p-1.5 shadow-lg">
            {options.map((opt) => (
              <label
                key={opt.key}
                title={opt.label}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-paper"
              >
                <input type="checkbox" checked={selected.has(opt.key)} onChange={() => onToggle(opt.key)} />
                <span className="min-w-0 flex-1 truncate text-ink">{opt.label}</span>
                <span className="shrink-0 font-mono text-xs text-ink-soft">{opt.count}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

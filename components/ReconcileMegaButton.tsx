'use client'

import { useRef, useState } from 'react'
import Spinner from '@/components/Spinner'

type Report = {
  totalRows: number
  matched: number
  stageDateMismatches: string[]
  grantSumMismatches: string[]
  missingContracts: string[]
  unmatchedRows: string[]
  clean: boolean
}

function ReportSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-ink">{title} ({items.length}):</p>
      <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
        {items.map((item, i) => (
          <li key={i}>• {item}</li>
        ))}
      </ul>
    </div>
  )
}

export default function ReconcileMegaButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef.current) inputRef.current.value = ''

    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch('/api/projects/reconcile-mega', { method: 'POST', body: file })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Не удалось сверить файл')
        return
      }
      setReport(data)
    } catch {
      setError('Проблема с сетью. Попробуй ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <input ref={inputRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" id="reconcile-mega-input" />
      <label
        htmlFor="reconcile-mega-input"
        className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1 text-center text-sm text-ink-soft transition hover:border-teal hover:text-teal"
      >
        {loading && <Spinner />}
        {loading ? 'Сверяю…' : 'Сверить с мега-таблицей'}
      </label>

      {(error || report) && (
        <div className="absolute z-30 mt-2 w-[min(90vw,32rem)] rounded-xl border border-line bg-white p-4 shadow-lg">
          {error && <p className="text-sm text-urgent">{error}</p>}
          {report && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">
                  Сопоставлено {report.matched} из {report.totalRows} строк
                </p>
                <button onClick={() => setReport(null)} className="text-xs text-ink-soft hover:text-ink">
                  закрыть
                </button>
              </div>
              {report.clean ? (
                <p className="mt-2 text-sm text-teal">Всё сходится, расхождений нет.</p>
              ) : (
                <>
                  <ReportSection title="Даты окончания этапов не совпадают" items={report.stageDateMismatches} />
                  <ReportSection title="Сумма гранта не совпадает" items={report.grantSumMismatches} />
                  <ReportSection title="Договоры есть в мега-таблице, но не у нас" items={report.missingContracts} />
                  <ReportSection title="Проектов из файла нет в базе" items={report.unmatchedRows} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

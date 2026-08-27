'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatRubRounded } from './constants'
import type { ClaimsSummary as ClaimsSummaryType } from '@/lib/project-finance'

export default function ClaimsSummary({ claims }: { claims: ClaimsSummaryType }) {
  const [showList, setShowList] = useState(false)

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-ink">Возвраты</h2>
      {claims.totalClaims === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Требований о возврате нет.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <button
              onClick={() => setShowList((v) => !v)}
              className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center transition hover:border-teal"
            >
              <p className="font-display text-sm font-semibold text-ink">{claims.totalClaims}</p>
              <p className="mt-0.5 text-xs text-ink-soft">всего требований</p>
            </button>
            <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
              <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(claims.sumBalance)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">Неизрасходованный остаток</p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
              <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(claims.sumMisuse)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">Нецелевой расход</p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
              <p className="font-display text-sm font-semibold text-ink">{formatRubRounded(claims.sumNoncompliance)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">Несоответствие требованиям договора гранта</p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-line p-3 text-center">
              <p className="font-display text-sm font-semibold text-done">{claims.resolvedCount}</p>
              <p className="mt-0.5 text-xs text-ink-soft">исполнено</p>
            </div>
          </div>
          <p className="mt-2 text-sm">
            {claims.outstandingCount === 0 ? (
              <span className="text-done">Все требования о возврате исполнены.</span>
            ) : (
              <span className="text-urgent">
                Не исполнено: {claims.outstandingCount} на {formatRubRounded(claims.sumOutstandingBalance)}
              </span>
            )}
          </p>

          {showList && (
            <div className="mt-3 divide-y divide-line rounded-xl border border-line">
              {claims.claims.map((c, i) => (
                <Link
                  key={i}
                  href={`/projects/${c.projectId}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition hover:text-teal"
                >
                  <span className="text-ink">
                    {c.code || `№${c.number}`} {c.claimNumber && `· ${c.claimNumber}`}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-xs text-ink-soft">
                    {formatRubRounded(c.balance ?? 0)}
                    <span className={c.resolved ? 'text-done' : 'text-urgent'}>{c.resolved ? 'исполнено' : 'не исполнено'}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import type { FeoDocument, FeoExpense, FeoPlanItem, FeoPurchase, FeoSheet } from '@/types'

const SUMMARY = '__summary'

function formatNum(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)
}
function formatRub(n: number | null | undefined) {
  return n === null || n === undefined ? '' : new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function formatDate(iso: string | null) {
  return iso ? iso.slice(0, 10).split('-').reverse().join('.') : ''
}
// «1.4.», «1.4», «Подэтап 1.4.» → «1.4»
const codeKey = (code: string) => (code.match(/\d+(?:\.\d+)*/)?.[0] ?? code).replace(/\.$/, '')

const matches = (q: string, ...values: unknown[]) => !q || values.some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q))

const cellCls = 'border border-[#d4d4d4] px-2 py-1 align-top'
const headCls = 'border border-[#d4d4d4] bg-[#f3f3f3] px-2 py-1.5 text-center font-semibold'

// ---------- таблица листа «как в Excel» ----------

function ExcelTable({ sheet, query }: { sheet: FeoSheet; query: string }) {
  const rows = sheet.rows.filter((r) => matches(query, ...r.c))
  // ширины из Excel — как минимальные: таблица растягивается на всю ширину страницы
  const width = (i: number) => Math.min(Math.max((sheet.cols[i]?.w ?? 10) * 7, 56), 460)
  return (
    <div className="max-h-[75vh] overflow-auto border border-[#d4d4d4]">
      <table className="w-full border-collapse text-xs text-ink">
        <colgroup>
          {sheet.cols.map((c, i) => (
            <col key={i} style={c.num ? { width: width(i), minWidth: width(i) } : { minWidth: width(i) }} />
          ))}
        </colgroup>
        {sheet.header.length > 0 && (
          <thead className="sticky top-0 z-10">
            {sheet.header.map((hr, i) => (
              <tr key={i}>
                {hr.map((h, j) => (
                  <th key={j} colSpan={h.cs} rowSpan={h.rs} className={`${headCls} align-middle leading-tight`}>
                    {h.t}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`${r.b ? 'bg-[#fafafa] font-semibold' : ''} hover:bg-teal-soft/40`}>
              {r.c.map((v, j) => (
                <td
                  key={j}
                  className={`${cellCls} leading-snug ${
                    // первый столбец — номер строки («1», «1.1.»), не число
                    typeof v === 'number' && j > 0 ? 'whitespace-nowrap text-right tabular-nums' : 'whitespace-pre-wrap'
                  }`}
                >
                  {v === null ? '' : typeof v === 'number' ? formatNum(v) : v}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={sheet.cols.length} className="px-3 py-4 text-center text-ink-soft">
                Ничего не найдено
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------- закупки ----------

type PurchaseLine = { p: FeoPurchase; amount: number; stage: number; sub: string; kind: string }

// Каждая позиция — в своём этапе со стоимостью на этап. Форма 2025: этап и подэтап указаны у позиции.
// Форма 2024: закупки разбиты по годам, а этап 1–2 волны = году (этап 1 — первый год ФЭО и т. д.),
// поэтому позиция на несколько лет попадает в каждый свой этап с суммой этого года.
function purchaseLines(doc: FeoDocument, purchases: FeoPurchase[]): PurchaseLine[] {
  if (doc.template === '2025') {
    return purchases.map((p) => {
      const sub = codeKey(p.substage_code)
      return { p, amount: p.total ?? 0, stage: Number(sub.split('.')[0]) || 0, sub, kind: p.object_type || p.category }
    })
  }
  const years = [...new Set(purchases.flatMap((p) => Object.keys(p.amounts)))].sort()
  return years.flatMap((y, i) =>
    purchases.filter((p) => p.amounts[y]).map((p) => ({ p, amount: p.amounts[y], stage: i + 1, sub: '', kind: p.category }))
  )
}

function Purchases({ doc, plan, purchases, query }: { doc: FeoDocument; plan: FeoPlanItem[]; purchases: FeoPurchase[]; query: string }) {
  const [stageFilter, setStageFilter] = useState(0)
  const [kindFilter, setKindFilter] = useState('')
  const all = useMemo(() => purchaseLines(doc, purchases), [doc, purchases])
  const stages = [...new Set(all.map((l) => l.stage))].sort((a, b) => a - b)
  const kinds = [...new Set(all.map((l) => l.kind).filter(Boolean))].sort()
  const lines = all.filter(
    (l) =>
      (!stageFilter || l.stage === stageFilter) &&
      (!kindFilter || l.kind === kindFilter) &&
      matches(query, l.p.name, l.p.purpose, l.p.category, l.p.object_type, l.sub)
  )

  const planByCode = new Map(plan.map((p) => [codeKey(p.code), p]))
  const period = (item?: FeoPlanItem) => (item?.start_date || item?.end_date ? ` (${formatDate(item.start_date) || '…'} – ${formatDate(item.end_date)})` : '')
  const stageYears = doc.template === '2024' ? [...new Set(purchases.flatMap((p) => Object.keys(p.amounts)))].sort() : []
  const stageTitle = (n: number) => {
    const item = planByCode.get(String(n))
    // «Наименование этапа 3» — незаполненная заготовка шаблона ФЭО
    const name = item && !/^наименование этапа/i.test(item.name) ? item.name.replace(/^этап\s*\d+\.?\s*/i, '') : ''
    const year = stageYears[n - 1] ? ` · ${stageYears[n - 1]} год` : ''
    return `Этап ${n}${year}${name ? ` — ${name}` : ''}${period(item)}`
  }
  const subTitle = (code: string) => {
    const item = planByCode.get(code)
    return `Подэтап ${code}${item ? ` — ${item.name}` : ''}${period(item)}`
  }
  const sum = (ls: PurchaseLine[]) => ls.reduce((s, l) => s + l.amount, 0)
  const selectCls = 'mt-1 block w-full rounded border border-line bg-white px-1 py-0.5 text-[11px] font-normal text-ink outline-none focus:border-teal'

  const row = (l: PurchaseLine) => (
    <tr key={`${l.stage}-${l.p.id}`} className="hover:bg-teal-soft/40">
      <td className={`${cellCls} whitespace-pre-wrap`}>{l.p.name || '—'}</td>
      <td className={cellCls}>{l.kind}</td>
      <td className={`${cellCls} whitespace-pre-wrap`}>{l.p.purpose}</td>
      <td className={`${cellCls} whitespace-nowrap text-right tabular-nums`}>{formatRub(l.amount)}</td>
    </tr>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs text-ink">
        <thead>
          <tr>
            <th className={`${headCls} min-w-72`}>
              Наименование
              <select value={stageFilter} onChange={(e) => setStageFilter(Number(e.target.value))} className={selectCls}>
                <option value={0}>Все этапы</option>
                {stages.map((n) => (
                  <option key={n} value={n}>Этап {n}</option>
                ))}
              </select>
            </th>
            <th className={`${headCls} min-w-48`}>
              Вид / раздел
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className={selectCls}>
                <option value="">Все виды</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </th>
            <th className={`${headCls} min-w-72`}>Цель</th>
            <th className={`${headCls} w-36`}>Стоимость, руб.</th>
          </tr>
        </thead>
        <tbody>
          {stages
            .filter((n) => lines.some((l) => l.stage === n))
            .map((n) => {
              const stageLines = lines.filter((l) => l.stage === n)
              const subs = [...new Set(stageLines.map((l) => l.sub))]
              return [
                <tr key={`s-${n}`} className="bg-[#e9eef0] font-semibold">
                  <td className={cellCls} colSpan={3}>{stageTitle(n)}</td>
                  <td className={`${cellCls} whitespace-nowrap text-right tabular-nums`}>{formatRub(sum(stageLines))}</td>
                </tr>,
                ...(doc.template === '2025'
                  ? subs.flatMap((sub) => {
                      const subLines = stageLines.filter((l) => l.sub === sub)
                      return [
                        <tr key={`ss-${sub}`} className="bg-[#fafafa] font-semibold">
                          <td className={cellCls} colSpan={3}>{subTitle(sub)}</td>
                          <td className={`${cellCls} whitespace-nowrap text-right tabular-nums`}>{formatRub(sum(subLines))}</td>
                        </tr>,
                        ...subLines.map(row),
                      ]
                    })
                  : stageLines.map(row)),
              ]
            })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-ink-soft">Ничего не найдено</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------- сводка ----------

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-display text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  )
}

function Summary({
  doc,
  sheets,
  plan,
  expenses,
  purchases,
  query,
}: {
  doc: FeoDocument
  sheets: FeoSheet[]
  plan: FeoPlanItem[]
  expenses: FeoExpense[]
  purchases: FeoPurchase[]
  query: string
}) {
  // форма 2024: итог и все статьи верхнего уровня (I, II, …), в том числе нулевые; этап = год
  const mainExpenses = expenses.filter((e) => /^[IVX]+$/.test(e.code) || /итого стоимость/i.test(e.name))
  const years = [...new Set(mainExpenses.flatMap((e) => Object.keys(e.amounts)))].sort()
  // форма 2025: «План по этапам» как в Excel — столбцы «год × этап», итоги этапов
  const byStagesSheet = sheets.find((s) => s.name === 'План по этапам')
  const warns = doc.checks.filter((c) => c.level === 'warn')
  const notes = doc.checks.filter((c) => c.level !== 'warn')

  return (
    <div className="space-y-6">
      {warns.length > 0 && (
        <div className="rounded-lg border border-normal/40 bg-normal-soft px-4 py-3 text-sm">
          <div className="mb-1 font-semibold text-ink">Несостыковки в файле ФЭО</div>
          <ul className="list-disc space-y-0.5 pl-5 text-ink">
            {warns.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
        </div>
      )}

      {doc.info.length > 0 && (
        <SummaryBlock title="Общая информация">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            {doc.info.map((i) => (
              <div key={i.label} className="contents">
                <dt className="text-ink-soft">{i.label}</dt>
                <dd className="text-ink">{i.value}</dd>
              </div>
            ))}
          </dl>
        </SummaryBlock>
      )}

      {doc.template === '2025' && byStagesSheet ? (
        <SummaryBlock title="Финансирование по годам и этапам, руб.">
          <ExcelTable sheet={byStagesSheet} query="" />
        </SummaryBlock>
      ) : (
        mainExpenses.length > 0 && (
          <SummaryBlock title="Финансирование по этапам, руб.">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-ink">
                <thead>
                  <tr>
                    <th className={`${headCls} w-10`}>№</th>
                    <th className={`${headCls} min-w-80`}>Статья расходов</th>
                    {years.map((y, i) => (
                      <th key={y} className={`${headCls} w-36`}>
                        Этап {i + 1}
                        <span className="block font-normal text-ink-soft">{y}</span>
                      </th>
                    ))}
                    <th className={`${headCls} w-36`}>ИТОГО</th>
                  </tr>
                </thead>
                <tbody>
                  {mainExpenses.map((e) => {
                    const isTotal = /итого/i.test(e.name)
                    return (
                      <tr key={e.id} className={isTotal ? 'bg-[#fafafa] font-semibold' : ''}>
                        <td className={`${cellCls} text-center`}>{e.code}</td>
                        <td className={cellCls}>{e.name}</td>
                        {years.map((y) => (
                          <td key={y} className={`${cellCls} whitespace-nowrap text-right tabular-nums`}>{formatRub(e.amounts[y] ?? 0)}</td>
                        ))}
                        <td className={`${cellCls} whitespace-nowrap text-right font-semibold tabular-nums`}>{formatRub(e.total ?? 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SummaryBlock>
        )
      )}

      <SummaryBlock title="Закупки по этапам">
        {purchases.length === 0 ? (
          <p className="text-sm text-ink-soft">Закупок в ФЭО нет</p>
        ) : (
          <Purchases doc={doc} plan={plan} purchases={purchases} query={query} />
        )}
      </SummaryBlock>

      {notes.length > 0 && <p className="text-xs text-ink-soft">{notes.map((n) => n.text).join(' · ')}</p>}
    </div>
  )
}

// ---------- страница ----------

export default function FeoView({
  project,
  doc,
  sheets,
  plan,
  expenses,
  purchases,
}: {
  project: { id: string; number: number; code: string; executor_short: string }
  doc: FeoDocument
  sheets: FeoSheet[]
  plan: FeoPlanItem[]
  expenses: FeoExpense[]
  purchases: FeoPurchase[]
}) {
  const [tab, setTab] = useState(SUMMARY)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const sheet = useMemo(() => sheets.find((s) => s.id === tab), [sheets, tab])
  const warnCount = doc.checks.filter((c) => c.level === 'warn').length

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-ink-soft">ID {project.number} · {project.executor_short}</div>
          <h1 className="font-display text-xl font-semibold text-ink">ФЭО · {project.code}</h1>
          <p className="mt-0.5 text-xs text-ink-soft">
            Форма {doc.template} года · файл «{doc.file_name}»
            {doc.file_modified_at && ` от ${formatDate(doc.file_modified_at)}`} · загружено {formatDate(doc.loaded_at)}
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по листу…"
          className="w-64 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-teal"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-line">
        {[{ id: SUMMARY, name: 'Сводка' }, ...sheets].map((s) => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            className={`-mb-px rounded-t-md border px-3 py-1.5 text-xs transition ${
              tab === s.id ? 'border-line border-b-white bg-white font-semibold text-ink' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {s.name}
            {s.id === SUMMARY && warnCount > 0 && (
              <span className="ml-1.5 rounded-full bg-normal-soft px-1.5 text-[10px] font-semibold text-normal">{warnCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {sheet ? (
          <>
            {sheet.caption && <p className="mb-2 text-sm font-semibold text-ink">{sheet.caption}</p>}
            <ExcelTable sheet={sheet} query={q} />
          </>
        ) : (
          <Summary doc={doc} sheets={sheets} plan={plan} expenses={expenses} purchases={purchases} query={q} />
        )}
      </div>
    </div>
  )
}

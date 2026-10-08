#!/usr/bin/env node
// Загрузка «Реестра договоров» (xlsx: Волна, Лот, Шифр, ID проекта, Номер договора, Дата, Исполнитель,
// Вид документа = «Договор» | «ДС») — допсоглашения кладём в project_contracts.additional_agreements
// родительского договора ({number, date}); номер ДС = «<номер договора>/N».
//
//   SUPABASE_DB_URL="postgresql://..." node scripts/import-contract-registry.mjs "<файл.xlsx>"          # сухой прогон
//   SUPABASE_DB_URL="postgresql://..." node scripts/import-contract-registry.mjs "<файл.xlsx>" --apply  # запись
//
// «ID проекта» = projects.number. Новые ДС добавляются, у существующих (по номеру) дата обновляется из
// реестра, ДС, которых нет в реестре, остаются. Сами договоры НЕ создаются и не правятся — только
// сверка (нет договора в базе / дата отличается — в отчёте). Пулер Supabase рвёт большие запросы —
// пишем по одному договору, соединение на запрос.

import fs from 'fs'
import { Client } from 'pg'
import XLSX from 'xlsx'

const file = process.argv[2]
const apply = process.argv.includes('--apply')
const url = process.env.SUPABASE_DB_URL
if (!file || !url) {
  console.error('Нужны путь к xlsx и SUPABASE_DB_URL (см. шапку скрипта)')
  process.exit(1)
}

XLSX.set_fs(fs)
const wb = XLSX.readFile(file)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
const hdr = rows[0].map((h) => String(h).trim())
const col = (n) => {
  const i = hdr.indexOf(n)
  if (i < 0) throw new Error(`Нет колонки «${n}»`)
  return i
}
const C = { pnum: col('ID проекта'), num: col('Номер договора'), date: col('Дата договора'), kind: col('Вид документа'), code: col('Шифр проекта') }

const iso = (v) => {
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10)
  const m = String(v).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const data = rows
  .slice(1)
  .filter((r) => String(r[C.num]).trim() !== '')
  .map((r) => ({
    pnum: Number(r[C.pnum]),
    code: String(r[C.code]).trim(),
    number: String(r[C.num]).trim(),
    date: iso(r[C.date]),
    kind: String(r[C.kind]).trim(),
  }))
const bad = data.filter((d) => !d.date || !d.pnum)
if (bad.length) throw new Error('Строки без даты/ID: ' + JSON.stringify(bad.slice(0, 5)))

async function q(text, params) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  c.on('error', () => {})
  await c.connect()
  try {
    return await c.query(text, params)
  } finally {
    await c.end()
  }
}

const projects = (await q('select id, number from projects')).rows
const byNum = new Map(projects.map((p) => [p.number, p.id]))
const contracts = (
  await q('select id, project_id, contract_number, contract_date::text as contract_date, additional_agreements from project_contracts')
).rows
const byKey = new Map(contracts.map((c) => [`${c.project_id}|${c.contract_number}`, c]))

const missingProjects = new Set()
const missingContracts = []
const dateMismatch = []
const changes = new Map() // contract id -> { contract, list }
let added = 0
let updated = 0
let same = 0

for (const d of data) {
  const pid = byNum.get(d.pnum)
  if (!pid) {
    missingProjects.add(d.pnum)
    continue
  }
  if (d.kind === 'Договор') {
    const c = byKey.get(`${pid}|${d.number}`)
    if (!c) missingContracts.push(`${d.code} (${d.pnum}): договор ${d.number} от ${d.date} — нет в базе`)
    else if (c.contract_date && c.contract_date !== d.date) dateMismatch.push(`${d.code}: ${d.number} в базе ${c.contract_date}, в реестре ${d.date}`)
    continue
  }
  const parent = d.number.split('/')[0]
  const c = byKey.get(`${pid}|${parent}`)
  if (!c) {
    missingContracts.push(`${d.code} (${d.pnum}): ДС ${d.number} от ${d.date} — нет родительского договора ${parent}`)
    continue
  }
  const entry = changes.get(c.id) ?? { contract: c, list: [...(c.additional_agreements ?? [])] }
  const ex = entry.list.find((a) => a.number === d.number)
  if (!ex) {
    entry.list.push({ number: d.number, date: d.date })
    added++
  } else if (ex.date !== d.date) {
    ex.date = d.date
    updated++
  } else {
    same++
    continue
  }
  changes.set(c.id, entry)
}

const suffix = (n) => Number(String(n).split('/')[1] ?? 0)
for (const e of changes.values()) e.list.sort((a, b) => suffix(a.number) - suffix(b.number))

console.log(`Строк в реестре: ${data.length} (договоров ${data.filter((d) => d.kind === 'Договор').length}, ДС ${data.filter((d) => d.kind !== 'Договор').length}).`)
console.log(`ДС: добавить ${added}, обновить дату ${updated}, уже есть ${same}. Договоров затронуто: ${changes.size}.`)
if (missingProjects.size) console.log('⚠ нет проектов с номерами:', [...missingProjects].join(', '))
for (const m of missingContracts) console.log('⚠', m)
for (const m of dateMismatch) console.log('⚠ дата договора:', m)

if (!apply) {
  console.log('\nСухой прогон. Для записи добавь --apply')
  process.exit(0)
}
for (const e of changes.values()) {
  await q('update project_contracts set additional_agreements = $1::jsonb where id = $2', [JSON.stringify(e.list), e.contract.id])
}
const total = (await q('select sum(jsonb_array_length(additional_agreements)) n from project_contracts')).rows[0].n
console.log(`Готово. Всего ДС в базе: ${total}.`)

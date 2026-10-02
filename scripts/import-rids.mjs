#!/usr/bin/env node
// Загрузка выгрузки «Реестр РИД» (xls из НИОКР БАС) в project_rids + карточка ЕГИСУ НИОКТР в projects.
//
//   SUPABASE_DB_URL="postgresql://...pooler.supabase.com:5432/postgres" \
//     node scripts/import-rids.mjs "<путь к .xls>"            # сухой прогон: что добавится/изменится
//     node scripts/import-rids.mjs "<путь к .xls>" --apply    # записать
//
// Соответствие: «ID проекта» = projects.number. РИД узнаём по (проект, название, № заявки) — новые
// добавляются, существующие обновляются из файла, отсутствующие в файле НЕ удаляются. Дата заявки =
// колонка «Дата приоритета» выгрузки. «Номер/Дата ЕГИСУ» — это карточка НИОКТР, одна на проект
// (projects.egisu_number / egisu_date), к РИД не привязана. Правообладатель и пустые колонки
// (международные заявки, рынок НТИ, сквозная технология) не загружаются.
// Пулер Supabase рвёт соединение на больших запросах — пишем маленькими пачками, по соединению на пачку.

import fs from 'fs'
import { Client } from 'pg'
import XLSX from 'xlsx'

const file = process.argv[2]
const apply = process.argv.includes('--apply')
const url = process.env.SUPABASE_DB_URL
if (!file || !url) {
  console.error('Нужны путь к xls и SUPABASE_DB_URL (см. шапку скрипта)')
  process.exit(1)
}

XLSX.set_fs(fs)
const wb = XLSX.readFile(file)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
const headerIdx = rows.findIndex((r) => String(r[0]).trim() === '№ п/п')
if (headerIdx < 0) throw new Error('Не нашёл строку заголовков «№ п/п»')
const hdr = rows[headerIdx].map((h) => String(h).trim().replace(/\s+/g, ' '))
const col = (name) => {
  const i = hdr.indexOf(name)
  if (i < 0) throw new Error(`Нет колонки «${name}»`)
  return i
}
const C = {
  pnum: col('ID проекта'),
  kind: col('Вид РИД'),
  title: col('РИД'),
  appNo: col('Номер заявки'),
  appDate: col('Дата приоритета'),
  docNo: col('Номер ОД'),
  status: col('Статус действия'),
  eNum: col('Номер ЕГИСУ'),
  eDate: col('Дата ЕГИСУ'),
  cNum: col('Номер ЕГИСУ о создании'),
  cDate: col('Дата ЕГИСУ о создании'),
  pNum: col('Номер ЕГИСУ о правовой охране'),
  pDate: col('Дата ЕГИСУ о правовой охране'),
  uNum: col('Номер ЕГИСУ об использовании'),
  uDate: col('Дата ЕГИСУ об использовании'),
}

const s = (v) => String(v ?? '').trim()
const d = (v) => {
  const m = s(v).match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const data = rows.slice(headerIdx + 1).filter((r) => s(r[0]) !== '' && !isNaN(Number(r[0])))
const items = data.map((r) => ({
  pnum: Number(r[C.pnum]),
  kind: s(r[C.kind]),
  title: s(r[C.title]),
  application_number: s(r[C.appNo]),
  application_date: d(r[C.appDate]),
  document_number: s(r[C.docNo]),
  action_status: s(r[C.status]),
  egisu_created_number: s(r[C.cNum]),
  egisu_created_date: d(r[C.cDate]),
  egisu_protection_number: s(r[C.pNum]),
  egisu_protection_date: d(r[C.pDate]),
  egisu_usage_number: s(r[C.uNum]),
  egisu_usage_date: d(r[C.uDate]),
}))
const projectEgisu = new Map()
for (const r of data) projectEgisu.set(Number(r[C.pnum]), { number: s(r[C.eNum]), date: d(r[C.eDate]) })

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

const FIELDS = [
  'kind', 'application_date', 'document_number', 'action_status', 'egisu_created_number', 'egisu_created_date',
  'egisu_protection_number', 'egisu_protection_date', 'egisu_usage_number', 'egisu_usage_date',
]

const projects = (await q('select id, number, egisu_number, egisu_date::text as egisu_date from projects')).rows
const byNumber = new Map(projects.map((p) => [p.number, p]))
const unknown = [...new Set(items.filter((i) => !byNumber.has(i.pnum)).map((i) => i.pnum))]
if (unknown.length) console.log('⚠ нет проектов с номерами:', unknown.join(', '), '— их РИД пропущены')

const existing = (
  await q(
    `select id, project_id, title, application_number, kind, application_date::text as application_date, document_number, action_status,
       egisu_created_number, egisu_created_date::text as egisu_created_date, egisu_protection_number, egisu_protection_date::text as egisu_protection_date,
       egisu_usage_number, egisu_usage_date::text as egisu_usage_date from project_rids`
  )
).rows
const slots = new Map()
for (const e of existing) {
  const k = `${e.project_id}|${e.title}|${e.application_number}`
  slots.set(k, [...(slots.get(k) ?? []), e])
}

const toInsert = []
const toUpdate = []
let unchanged = 0
const used = new Map()
for (const it of items) {
  const p = byNumber.get(it.pnum)
  if (!p) continue
  const k = `${p.id}|${it.title}|${it.application_number}`
  const n = used.get(k) ?? 0
  used.set(k, n + 1)
  const ex = (slots.get(k) ?? [])[n]
  if (!ex) {
    toInsert.push({ ...it, project_id: p.id })
    continue
  }
  const diff = FIELDS.filter((f) => (ex[f] ?? null) !== (it[f] ?? null) && !((ex[f] ?? '') === '' && (it[f] ?? '') === ''))
  if (diff.length) toUpdate.push({ ...it, id: ex.id, _diff: diff })
  else unchanged++
}

const egisuChanges = []
for (const [num, eg] of projectEgisu) {
  const p = byNumber.get(num)
  if (!p) continue
  if ((p.egisu_number ?? '') !== eg.number || (p.egisu_date ?? null) !== (eg.date ?? null)) {
    egisuChanges.push({ id: p.id, number: eg.number, date: eg.date, was: p.egisu_number, num })
  }
}

console.log(`Строк в файле: ${items.length}. РИД: новых ${toInsert.length}, изменённых ${toUpdate.length}, без изменений ${unchanged}.`)
console.log(`Карточка ЕГИСУ НИОКТР проектов: к обновлению ${egisuChanges.length}.`)
for (const c of egisuChanges.filter((c) => c.was && c.was !== c.number)) console.log(`  ⚠ проект ${c.num}: номер в базе «${c.was}» → в файле «${c.number}»`)
for (const u of toUpdate.slice(0, 10)) console.log(`  ~ ${u.title.slice(0, 60)}: ${u._diff.join(', ')}`)

if (!apply) {
  console.log('\nСухой прогон. Для записи добавь --apply')
  process.exit(0)
}

const COLS = ['kind', 'title', 'application_number', 'application_date', 'document_number', 'action_status', 'egisu_created_number',
  'egisu_created_date', 'egisu_protection_number', 'egisu_protection_date', 'egisu_usage_number', 'egisu_usage_date']
const typed = `project_id uuid, id uuid, kind text, title text, application_number text, application_date date, document_number text, action_status text,
  egisu_created_number text, egisu_created_date date, egisu_protection_number text, egisu_protection_date date, egisu_usage_number text, egisu_usage_date date`

for (let i = 0; i < toInsert.length; i += 10) {
  await q(
    `insert into project_rids (project_id, ${COLS.join(', ')}) select x.project_id, ${COLS.map((c) => 'x.' + c).join(', ')}
     from jsonb_to_recordset($1::jsonb) as x(${typed})`,
    [JSON.stringify(toInsert.slice(i, i + 10))]
  )
}
for (let i = 0; i < toUpdate.length; i += 10) {
  await q(
    `update project_rids r set ${FIELDS.map((f) => `${f} = x.${f}`).join(', ')} from jsonb_to_recordset($1::jsonb) as x(${typed}) where r.id = x.id`,
    [JSON.stringify(toUpdate.slice(i, i + 10))]
  )
}
for (let i = 0; i < egisuChanges.length; i += 10) {
  await q(
    `update projects p set egisu_number = x.number, egisu_date = x.date from jsonb_to_recordset($1::jsonb) as x(id uuid, number text, date date) where p.id = x.id`,
    [JSON.stringify(egisuChanges.slice(i, i + 10))]
  )
}
const total = (await q('select count(*) from project_rids')).rows[0].count
console.log(`Готово. Всего РИД в базе: ${total}.`)

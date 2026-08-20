#!/usr/bin/env node
// Разовый импорт реестра НИОКР-проектов в projects/project_contracts/project_stages/
// project_checklist_items. Источник — reestr-proektov-rasshirenny_1.md (в .gitignore,
// содержит реальные ИНН/КПП/суммы грантов).
//
// Запуск: SUPABASE_DB_URL="postgresql://...pooler.supabase.com:5432/postgres" node scripts/import-projects.mjs
// (или просто node scripts/import-projects.mjs, если SUPABASE_DB_URL уже в .env.local)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

if (!process.env.SUPABASE_DB_URL) {
  const envPath = path.join(ROOT, '.env.local')
  if (fs.existsSync(envPath)) {
    const match = fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('SUPABASE_DB_URL='))
    if (match) process.env.SUPABASE_DB_URL = match.slice('SUPABASE_DB_URL='.length).trim()
  }
}

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('SUPABASE_DB_URL не задан (env или .env.local).')
  process.exit(1)
}

const registryPath = path.join(ROOT, 'reestr-proektov-rasshirenny_1.md')
if (!fs.existsSync(registryPath)) {
  console.error(`Не найден файл реестра: ${registryPath}`)
  process.exit(1)
}

// --- шаблон чек-листа (JS-копия lib/project-checklist-templates.ts — этот
// скрипт запускается напрямую через node без сборки TS, дублировать проще,
// чем тащить ts-node ради одного разового скрипта) ---

function minusMonths(dateISO, months) {
  if (!dateISO) return null
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(y, m - 1 - months, d)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const TECHNICAL_TEMPLATE = [
  { template_key: 'tech_1', title: 'Открыть точку загрузки 1-го комплекта отчётной документации', computeTargetDate: (s) => minusMonths(s.end_date, 1) },
  { template_key: 'tech_2', title: 'Комплект получен → отправлен в МФТИ', computeTargetDate: () => null },
  { template_key: 'tech_3', title: 'Ожидаем замечания от МФТИ', computeTargetDate: () => null },
  { template_key: 'tech_4', title: 'Открыта повторная точка (финальный комплект) — если были замечания', computeTargetDate: () => null },
  { template_key: 'tech_5', title: 'Финальный комплект принят', computeTargetDate: () => null },
  { template_key: 'tech_6', title: 'Результаты утверждены на Грантовой комиссии', computeTargetDate: () => null },
]

const FINANCIAL_TEMPLATE = [
  { template_key: 'fin_1', title: 'Точка открывается в дату окончания этапа', computeTargetDate: (s) => s.end_date },
  { template_key: 'fin_2', title: 'Документы получены → проверены', computeTargetDate: () => null },
  { template_key: 'fin_3', title: 'Переданы экспертам в работу', computeTargetDate: () => null },
  { template_key: 'fin_4', title: 'Направлены замечания от эксперта — получены пояснения', computeTargetDate: () => null },
  { template_key: 'fin_5', title: 'Получено заключение от эксперта', computeTargetDate: () => null },
  { template_key: 'fin_6', title: 'Направлено требование о возврате', computeTargetDate: () => null },
  { template_key: 'fin_7', title: 'Исполнено требование о возврате', computeTargetDate: () => null },
  { template_key: 'fin_8', title: 'Результаты утверждены на Грантовой комиссии', computeTargetDate: () => null },
]

function buildChecklistRows(stage) {
  const rows = []
  TECHNICAL_TEMPLATE.forEach((step, i) => {
    rows.push({ track: 'technical', step_order: i + 1, template_key: step.template_key, title: step.title, target_date: step.computeTargetDate(stage) })
  })
  FINANCIAL_TEMPLATE.forEach((step, i) => {
    rows.push({ track: 'financial', step_order: i + 1, template_key: step.template_key, title: step.title, target_date: step.computeTargetDate(stage) })
  })
  return rows
}

// --- парсинг реестра ---

function ddmmyyyyToISO(s) {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function rubToNumber(s) {
  const cleaned = s.replace(/\s|руб\.?/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function field(block, label) {
  const re = new RegExp(`^- ${label}:\\s*(.+)$`, 'm')
  const m = block.match(re)
  return m ? m[1].trim() : ''
}

function parseExecutorFull(raw) {
  // 'Федеральное ... "Название" (ИНН 1234567890, КПП 123456789)'
  const m = raw.match(/^(.*?)\s*\(ИНН\s*([\d]+),\s*КПП\s*([\d]+)\)\s*$/s)
  if (!m) return { full: raw.trim(), inn: '', kpp: '' }
  return { full: m[1].trim(), inn: m[2].trim(), kpp: m[3].trim() }
}

function parseContracts(raw) {
  if (!raw) return []
  return raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(\S+)\s+от\s+(\S+)\s*\((\d{4})\)$/)
      if (!m) return null
      const dateISO = m[2] === 'None' ? null : ddmmyyyyToISO(m[2])
      return { contract_number: m[1], contract_date: dateISO, contract_year: Number(m[3]) }
    })
    .filter(Boolean)
}

function parseStages(raw) {
  // 'этап 1 — до 31.12.2024 (30 123 984,49 руб.); этап 2 — до ...'
  if (!raw) return []
  return raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/этап\s+(\d+)\s*—\s*до\s+(\d{2}\.\d{2}\.\d{4})\s*\(([\d\s.,]+)\s*руб\.?\)/i)
      if (!m) return null
      return {
        stage_number: Number(m[1]),
        end_date: ddmmyyyyToISO(m[2]),
        cost: rubToNumber(m[3]),
      }
    })
    .filter(Boolean)
}

function parseRegistry(text) {
  const projects = []
  const waveBlocks = text.split(/\n## /).slice(1) // отбрасываем преамбулу до первого "## "

  for (const waveBlock of waveBlocks) {
    const waveHeaderMatch = waveBlock.match(/^(\d+)\s*конкурсный отбор/)
    if (!waveHeaderMatch) continue
    const wave = Number(waveHeaderMatch[1])

    const projectBlocks = waveBlock.split(/\n### /).slice(1)
    for (const block of projectBlocks) {
      const headerMatch = block.match(/^(Лот\s*\d+)\s*—\s*(.+?)\s*\n/)
      if (!headerMatch) continue
      const lot_label = headerMatch[1].trim()
      const code = headerMatch[2].trim()

      const number = Number(field(block, 'Номер проекта'))
      const tech_direction = field(block, 'Технологическое направление')
      const executor_short = field(block, 'Краткое наим\\.')
      const executorFullRaw = field(block, 'Полное наим\\.')
      const { full: executor_full, inn: executor_inn, kpp: executor_kpp } = parseExecutorFull(executorFullRaw)
      const executor_address = field(block, 'Адрес')
      const topicRaw = field(block, 'Тема НИОКР')
      const topic = topicRaw.replace(/^«/, '').replace(/»$/, '').trim()
      const contractsRaw = field(block, 'Договор\\(ы\\)')
      const stagesRaw = field(block, 'Этапы НИОКР \\(\\d+\\)')

      if (!number) continue

      projects.push({
        number,
        wave,
        lot_label,
        code,
        tech_direction,
        topic,
        executor_short,
        executor_full,
        executor_inn,
        executor_kpp,
        executor_address,
        contracts: parseContracts(contractsRaw),
        stages: parseStages(stagesRaw),
      })
    }
  }

  return projects
}

async function main() {
  const text = fs.readFileSync(registryPath, 'utf8')
  const projects = parseRegistry(text)
  console.log(`Разобрано проектов: ${projects.length}`)

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(projects.slice(0, 2), null, 2))
    console.log(JSON.stringify(projects[projects.length - 1], null, 2))
    const totalStages = projects.reduce((sum, p) => sum + p.stages.length, 0)
    const totalContracts = projects.reduce((sum, p) => sum + p.contracts.length, 0)
    console.log(`Всего этапов: ${totalStages}, договоров: ${totalContracts}`)
    return
  }

  let insertedProjects = 0
  let insertedContracts = 0
  let insertedStages = 0
  let insertedChecklist = 0
  const skipped = []

  // Пул-соединение в этом окружении регулярно рвётся посреди работы
  // ("Connection terminated unexpectedly") — не по вине скрипта. Каждый
  // проект вставляется одной транзакцией (BEGIN..COMMIT), поэтому обрыв
  // посреди проекта откатывает его целиком — "skip if number exists" ниже
  // остаётся безопасным (проект либо вставлен полностью, либо не вставлен
  // вообще, никогда не наполовину). При обрыве просто переподключаемся и
  // продолжаем с того же проекта.
  async function connect() {
    const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    // Обрыв сокета иногда всплывает как событие 'error' на клиенте, а не как
    // отклонённый промис запроса — без обработчика Node считает это
    // необработанным исключением и роняет весь процесс. Гасим здесь, реальная
    // реакция (rollback+reconnect) всё равно происходит в catch вокруг query().
    c.on('error', (err) => console.error(`\n(соединение оборвалось: ${err.message})`))
    await c.connect()
    return c
  }

  let client = await connect()
  let projectIndex = 0
  let attemptsOnCurrent = 0
  while (projectIndex < projects.length) {
    const p = projects[projectIndex]
    try {
      const existing = await client.query('select id from projects where number = $1', [p.number])
      if (existing.rows.length > 0) {
        skipped.push(p.number)
        projectIndex += 1
        attemptsOnCurrent = 0
        continue
      }

      await client.query('begin')

      const projectRes = await client.query(
        `insert into projects (number, wave, lot_label, code, tech_direction, topic, executor_short, executor_full, executor_inn, executor_kpp, executor_address)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [p.number, p.wave, p.lot_label, p.code, p.tech_direction, p.topic, p.executor_short, p.executor_full, p.executor_inn, p.executor_kpp, p.executor_address]
      )
      const projectId = projectRes.rows[0].id
      insertedProjects += 1

      // Батчим вставки в один multi-row INSERT на сущность — иначе на этот
      // проект уходит ~14 отдельных запросов на чек-лист одного этапа, и на
      // pooler-соединении это упирается в "Connection terminated unexpectedly"
      // задолго до конца всех 54 проектов.
      if (p.contracts.length > 0) {
        const values = []
        const params = []
        p.contracts.forEach((c, i) => {
          const base = i * 4
          values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4})`)
          params.push(projectId, c.contract_number, c.contract_date, c.contract_year)
        })
        await client.query(
          `insert into project_contracts (project_id, contract_number, contract_date, contract_year) values ${values.join(',')}`,
          params
        )
        insertedContracts += p.contracts.length
      }

      for (const s of p.stages) {
        const stageRes = await client.query(
          `insert into project_stages (project_id, stage_number, end_date, cost) values ($1,$2,$3,$4) returning id`,
          [projectId, s.stage_number, s.end_date, s.cost]
        )
        const stageId = stageRes.rows[0].id
        insertedStages += 1

        const rows = buildChecklistRows({ end_date: s.end_date })
        const values = []
        const params = []
        rows.forEach((row, i) => {
          const base = i * 6
          values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},true,$${base + 5},$${base + 6})`)
          params.push(stageId, row.track, row.step_order, row.template_key, row.title, row.target_date)
        })
        await client.query(
          `insert into project_checklist_items (stage_id, track, step_order, template_key, is_default, title, target_date) values ${values.join(',')}`,
          params
        )
        insertedChecklist += rows.length
      }

      await client.query('commit')
      projectIndex += 1
      attemptsOnCurrent = 0
      process.stdout.write(`\r${projectIndex}/${projects.length} проектов…`)
    } catch (err) {
      attemptsOnCurrent += 1
      console.error(`\nОшибка на проекте №${p.number} (попытка ${attemptsOnCurrent}): ${err.message}`)
      await client.query('rollback').catch(() => {})
      await client.end().catch(() => {})
      if (attemptsOnCurrent >= 8) {
        console.error(`Проект №${p.number} не удалось вставить за 8 попыток, останавливаюсь.`)
        process.exit(1)
      }
      // Небольшая пауза перед переподключением — облегчает временные сбои сети/пула,
      // а не долбит немедленным ретраем в то же самое нестабильное состояние.
      await new Promise((resolve) => setTimeout(resolve, 3000))
      client = await connect()
    }
  }
  await client.end().catch(() => {})

  console.log(`\nВставлено проектов: ${insertedProjects}`)
  console.log(`Вставлено договоров: ${insertedContracts}`)
  console.log(`Вставлено этапов: ${insertedStages}`)
  console.log(`Вставлено пунктов чек-листа: ${insertedChecklist}`)
  if (skipped.length) console.log(`Пропущено (уже существуют, номер проекта): ${skipped.join(', ')}`)
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})

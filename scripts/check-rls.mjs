#!/usr/bin/env node
// Проверяет, что у каждой таблицы с RLS есть policy на select/insert/update/delete.
// Postgres по умолчанию ЗАПРЕЩАЕТ операцию, если для неё нет ни одной policy —
// именно так дважды тихо ломались фичи в этом проекте (tasks_update, employees update).
//
// Запуск: SUPABASE_DB_URL="postgresql://...pooler.supabase.com:5432/postgres" npm run check:rls
// Строку подключения бери в Supabase → Project Settings → Database → Connection string
// (вариант "Session pooler" — прямое подключение часто не резолвится без IPv6).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Без лишней зависимости на dotenv: если SUPABASE_DB_URL не задан в окружении,
// подхватываем его из .env.local (тот же файл, что читает Next.js).
if (!process.env.SUPABASE_DB_URL) {
  const envPath = path.join(__dirname, '..', '.env.local')
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
  console.error(
    'SUPABASE_DB_URL не задан.\n' +
      'Возьми pooler-connection string: Supabase → Project Settings → Database → Connection string.\n' +
      'Запусти: SUPABASE_DB_URL="postgresql://...pooler.supabase.com:5432/postgres" npm run check:rls'
  )
  process.exit(1)
}

const OPS = ['r', 'a', 'w', 'd']
const OP_LABELS = { r: 'select', a: 'insert', w: 'update', d: 'delete' }

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    const { rows: tables } = await client.query(`
      select c.relname as table_name, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `)

    const { rows: policies } = await client.query(`
      select polrelid::regclass::text as table_name, polcmd
      from pg_policy
    `)

    let hasGap = false
    const rows = []

    for (const t of tables) {
      const tablePolicies = policies.filter((p) => p.table_name === t.table_name)
      const covered = new Set()
      tablePolicies.forEach((p) => {
        if (p.polcmd === '*') OPS.forEach((op) => covered.add(op))
        else covered.add(p.polcmd)
      })

      const missing = t.rls_enabled ? OPS.filter((op) => !covered.has(op)) : []
      if (missing.length) hasGap = true

      rows.push({
        table: t.table_name,
        rls: t.rls_enabled,
        select: covered.has('r'),
        insert: covered.has('a'),
        update: covered.has('w'),
        delete: covered.has('d'),
        missing: missing.map((op) => OP_LABELS[op]),
      })
    }

    console.log('Таблица              RLS    select insert update delete')
    console.log('-'.repeat(58))
    for (const r of rows) {
      const cell = (has) => (r.rls ? (has ? ' ✓ ' : ' ✗ ') : ' - ')
      console.log(
        `${r.table.padEnd(20)} ${(r.rls ? 'вкл' : 'выкл').padEnd(6)} ${cell(r.select)}   ${cell(r.insert)}   ${cell(r.update)}   ${cell(r.delete)}`
      )
    }

    console.log()
    if (hasGap) {
      console.log('⚠ Есть таблицы с RLS, но без policy на какие-то операции:')
      rows
        .filter((r) => r.missing.length)
        .forEach((r) => console.log(`  - ${r.table}: нет policy на ${r.missing.join(', ')}`))
      console.log()
      console.log('Postgres по умолчанию запрещает операцию, если для неё нет ни одной policy.')
      console.log('Если это осознанное решение (например, delete нигде не нужен) — ок, иначе почини.')
      process.exitCode = 1
    } else {
      console.log('✓ Все таблицы с RLS покрыты policy на каждую операцию.')
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})

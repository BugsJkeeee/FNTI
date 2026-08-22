import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'

// Сверка с «Мега-таблицей договоры НИОКР» по кнопке — та же проверка, что делалась вручную
// при первом импорте (совпадение дат окончания этапов и суммы гранта, недостающие договоры),
// только доступная в любой момент и без файла на сервере: xlsx приходит прямо в теле запроса
// (файл лежит только в private/ у пользователя локально, на Vercel его нет и не будет).

function excelSerialToISO(v: string) {
  const s = String(v).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = Date.UTC(1899, 11, 30) + n * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}
function parseAmountUS(s: string) {
  const t = String(s).replace(/,/g, '').trim()
  if (!t) return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const buffer = Buffer.from(await req.arrayBuffer())
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Пустой файл' }, { status: 400 })
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать файл — это точно .xlsx мега-таблицы?' }, { status: 400 })
  }

  const sheet = workbook.Sheets['Проекты']
  if (!sheet) {
    return NextResponse.json({ error: 'В файле нет листа «Проекты»' }, { status: 400 })
  }

  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  const header = rows[0]
  const megaRows = rows.slice(1).map((r) => {
    const o: Record<string, string> = {}
    header.forEach((h, i) => { o[h] = (r[i] ?? '').toString().trim() })
    return o
  })

  const supabase = await createClient()
  const { data: ourProjects, error } = await supabase
    .from('projects')
    .select('id, number, code, contracts:project_contracts(contract_number, contract_year), stages:project_stages(stage_number, end_date, cost)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byNumber = new Map((ourProjects ?? []).map((p) => [String(p.number), p]))

  const stageDateMismatches: string[] = []
  const grantSumMismatches: string[] = []
  const missingContracts: string[] = []
  const unmatchedRows: string[] = []
  let matched = 0

  for (const row of megaRows) {
    const idPm = row['ID PM']
    if (!idPm) continue
    const ours = byNumber.get(idPm)
    if (!ours) {
      unmatchedRows.push(`ID PM ${idPm} (${row['Шифр']}) — такого проекта нет у нас в базе`)
      continue
    }
    matched++

    for (const n of [1, 2, 3]) {
      const iso = excelSerialToISO(row[`Окончание этапа ${n}`])
      if (!iso) continue
      const stage = ours.stages.find((s) => s.stage_number === n)
      if (stage && stage.end_date !== iso) {
        stageDateMismatches.push(`№${ours.number} ${ours.code}, этап ${n}: у нас ${stage.end_date ?? '—'}, в мега-таблице ${iso}`)
      }
    }

    const grantSum = parseAmountUS(row['Сумма гранта из сводной'])
    if (grantSum != null) {
      const sumCost = ours.stages.reduce((acc, s) => acc + (Number(s.cost) || 0), 0)
      if (Math.abs(sumCost - grantSum) > 1) {
        grantSumMismatches.push(`№${ours.number} ${ours.code}: сумма этапов у нас ${sumCost.toLocaleString('ru-RU')} ₽, в мега-таблице ${grantSum.toLocaleString('ru-RU')} ₽`)
      }
    }

    for (const year of [2024, 2025, 2026] as const) {
      const num = row[`Номер грантового договора ${year} года`]
      if (!num) continue
      const has = ours.contracts.some((c) => c.contract_number === num)
      if (!has) {
        missingContracts.push(`№${ours.number} ${ours.code}: договор ${year} года «${num}» есть в мега-таблице, но не заведён у нас`)
      }
    }
  }

  return NextResponse.json({
    totalRows: megaRows.length,
    matched,
    stageDateMismatches,
    grantSumMismatches,
    missingContracts,
    unmatchedRows,
    clean: stageDateMismatches.length === 0 && grantSumMismatches.length === 0 && missingContracts.length === 0 && unmatchedRows.length === 0,
  })
}

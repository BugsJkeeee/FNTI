#!/usr/bin/env node
// Загрузка ФЭО (финансово-экономических обоснований) в базу — см. supabase-schema-feo.sql.
//
//   node scripts/import-feo.mjs <файл.xlsx> [ещё файлы...]            # сухой прогон: отчёт + private/feo-preview/<№>.json
//   node scripts/import-feo.mjs <файл.xlsx> [ещё файлы...] --apply    # запись (заменяет загруженное ФЭО проекта)
//
// Проект определяется по имени файла: «2.14 Уникум_ГОСНИИАС.xlsx» → шифр «Уникум» (ФЭО 1–2 волны),
// «4121.xlsx» → проект №4121 (ФЭО 3 волны). Доступ к базе — .env.local (URL + service role).
//
// Две формы ФЭО: 2024 года (листы «П_05_ПЛАН_НИОКР», «Расходы», …, суммы в тыс. руб.) и 2025 года
// («План выполн», «План по годам», «МТО,раб,усл», …, суммы в руб.). Исполнители двигали столбцы,
// удаляли/скрывали их и оставляли заготовки шаблона, поэтому всё ищется по тексту шапки, а не по
// буквам столбцов: таблица начинается со столбца «№»/«№ п/п», служебные столбцы левее и скрытые
// отбрасываются, строки без данных («Наименование 3», «<выбрать из cписка>», нули) — тоже.

import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

XLSX.set_fs(fs)

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const apply = process.argv.includes('--apply')
if (!files.length) {
  console.error('Укажи один или несколько файлов ФЭО (см. шапку скрипта)')
  process.exit(1)
}

// .env.local без dotenv — как в scripts/check-rls.mjs
const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ---------- общие помощники ----------

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
// «cписка» в шаблоне написано с латинской «c»
const PLACEHOLDER = /^(-|–|—|<выбрать из [cс]писка>|наименование \d+|должность \d+|содержание выполняемых работ_\d+|выдаваемые результаты_\d+|н\/п)$/i
const isRoman = (s) => /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(s)
const FINANCE_SHEETS = /^(Расходы|План по годам|План по этапам)$/
const SKIP_SHEETS = /^инструкция|^выпадающий|^вспомог|^ЕМИСС|^2_3_6/i
const PLAIN_SHEETS = /^(Основная информация|Предпосылки)$/i
const SIGNATURE = /\(подпись\)|\(ФИО\)|\(Должность руководителя|^М\.П\.?$|Приложение \d+ к объявлению/i

function excelDate(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5)
  return d.toISOString().slice(0, 10)
}
const ruDate = (iso) => iso.split('-').reverse().join('.')

// «1 234,56» → 1234.56; иначе null
function textNumber(s) {
  const t = String(s).replace(/ /g, ' ').trim()
  if (!/^-?\d[\d ]*([.,]\d+)?$/.test(t)) return null
  return Number(t.replace(/ /g, '').replace(',', '.'))
}

// Код строки → сегменты: «1.1.2.» → [1,1,2], «Подэтап 1.2.» → [1,2], «Этап 1» → [1], «II» → null
function codeSegments(code) {
  const m = norm(code).match(/(\d+(?:\.\d+)*)\.?$/)
  return m ? m[1].split('.').map(Number) : null
}
const isPrefix = (a, b) => a.length < b.length && a.every((x, i) => x === b[i])

// ---------- очистка листа ----------

function readGrid(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1')
  const hiddenCols = new Set((ws['!cols'] ?? []).map((c, i) => (c?.hidden ? i : -1)).filter((i) => i >= 0))
  const hiddenRows = new Set((ws['!rows'] ?? []).map((r, i) => (r?.hidden ? i : -1)).filter((i) => i >= 0))
  let errors = 0
  const grid = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell) row[c] = null
      else if (cell.t === 'e') { errors++; row[c] = null }
      else row[c] = cell.v
    }
    grid[r] = row
  }
  return { grid, range, hiddenCols, hiddenRows, errors }
}

const hasText = (v) => v !== null && v !== undefined && norm(v) !== ''

// opts.finance — финансовый лист (Расходы, План по годам/этапам): статьи показываем и с нулями;
// opts.keepCol(текст шапки) — столбцы, которые оставить, даже если в них одни нули.
function cleanSheet(name, ws, opts = {}) {
  const { grid, range, hiddenCols, hiddenRows, errors } = readGrid(ws)
  const notes = []
  if (errors) notes.push({ level: 'info', text: `«${name}»: ${errors} ячеек с ошибками формул (#ЗНАЧ!, #ССЫЛКА! и т. п.) — не показываются` })
  const rowsIdx = []
  for (let r = range.s.r; r <= range.e.r; r++) if (!hiddenRows.has(r)) rowsIdx.push(r)

  // --- лист «как есть» (Основная информация, Предпосылки): все непустые строки, без шапки
  if (PLAIN_SHEETS.test(name)) {
    const kept = rowsIdx.filter((r) => grid[r].some(hasText) && !grid[r].some((v) => SIGNATURE.test(norm(v))))
    const cols = []
    for (let c = range.s.c; c <= range.e.c; c++) if (!hiddenCols.has(c) && kept.some((r) => hasText(grid[r][c]))) cols.push(c)
    return {
      name, caption: '', notes, cols: cols.map((c) => colInfo(ws, c, false)), header: [],
      rows: kept.map((r) => ({ c: cols.map((c) => cellOut(grid[r][c])) })),
      plain: true, grid, keptRows: kept, keptCols: cols,
    }
  }

  // --- табличный лист: шапка ищется по «№»
  const hdrRow = rowsIdx.find((r) => grid[r].some((v, c) => !hiddenCols.has(c) && /^№( п\/п)?$/.test(norm(v))))
  if (hdrRow === undefined) return null
  const firstCol = grid[hdrRow].findIndex((v, c) => !hiddenCols.has(c) && /^№( п\/п)?$/.test(norm(v)))
  // строка нумерации столбцов «1 | 2 | 3 …» закрывает шапку
  const isNumbering = (r) => {
    const vals = grid[r].filter((v, c) => c >= firstCol && !hiddenCols.has(c) && hasText(v))
    return vals.length >= 3 && vals.slice(0, 3).every((v, i) => Number(v) === i + 1)
  }
  let numRow = rowsIdx.find((r) => r > hdrRow && r <= hdrRow + 4 && isNumbering(r))
  const headerRows = rowsIdx.filter((r) => r >= hdrRow && (numRow === undefined ? r === hdrRow : r < numRow))
  const dataStart = numRow !== undefined ? numRow + 1 : hdrRow + 1
  const caption = rowsIdx
    .filter((r) => r < hdrRow)
    .map((r) => grid[r].filter((v, c) => !hiddenCols.has(c) && hasText(v) && !/^\d+$/.test(norm(v)) && !/^(ТИП ДОКУМЕНТА:|ПОДГРУЖАЕМЫЙ)/.test(norm(v))).map(norm).join(' '))
    .filter(Boolean)
    .join(' · ')

  // смысл столбцов — по тексту шапки (все строки шапки вместе)
  const visCols = []
  for (let c = firstCol; c <= range.e.c; c++) if (!hiddenCols.has(c)) visCols.push(c)
  const headText = (c) => headerRows.map((r) => norm(grid[r][c])).join(' ')
  // текст столбца — все строки шапки; у объединённой ячейки — текст её левой верхней
  const mergedText = (c) => {
    const parts = []
    for (const r of headerRows) {
      const m = (ws['!merges'] ?? []).find((m) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c)
      const t = norm(m ? grid[m.s.r][m.s.c] : grid[r][c])
      // объединение на несколько строк шапки даёт один и тот же текст — берём один раз
      if (t && t !== parts.at(-1)) parts.push(t)
    }
    return parts.join(' ')
  }
  const sem = new Map(visCols.map((c) => [c, mergedText(c) || headText(c)]))
  const codeCol = firstCol
  const nameCol = visCols.find((c) => /наименование/i.test(sem.get(c)))
  // служебные столбцы-ярлыки: единица измерения и «Номер этапа / подэтапа» (дублирует № п/п)
  const unitCols = visCols.filter((c) => /ед\.? ?изм|единица измерения|номер этапа/i.test(sem.get(c)))
  const numCols = new Set(
    visCols.filter((c) => /(^|\s)20\d\d(\s|$)|итого|стоимость|руб|кол-во|чел\.-мес|количество/i.test(sem.get(c)) && !/обоснование|наименование|цель/i.test(sem.get(c)))
  )
  const dateCols = new Set(visCols.filter((c) => /начало|окончание|дата|срок действия/i.test(sem.get(c))))
  const labelCols = new Set([codeCol, nameCol, ...unitCols].filter((c) => c !== undefined))

  // значения строк данных: текст-числа в числовых столбцах → числа, даты из серийных номеров
  let textNums = 0
  const valueOf = (r, c) => {
    let v = grid[r][c]
    if (v === null || v === undefined) return null
    if (typeof v === 'string' && numCols.has(c)) {
      const n = textNumber(v)
      if (n !== null) { textNums++; v = n }
    }
    if (typeof v === 'number' && dateCols.has(c) && v > 20000 && v < 80000) return { date: excelDate(v) }
    return v
  }
  const meaningful = (v, c) => {
    if (v === null || v === undefined) return false
    if (typeof v === 'object') return true
    if (typeof v === 'number') return v !== 0
    const t = norm(v)
    return t !== '' && !PLACEHOLDER.test(t) && !(numCols.has(c) && t === '0')
  }

  const data = []
  for (const r of rowsIdx) {
    if (r < dataStart) continue
    const raw = grid[r]
    if (raw.some((v) => SIGNATURE.test(norm(v)))) continue
    const vals = new Map(visCols.map((c) => [c, valueOf(r, c)]))
    const code = norm(vals.get(codeCol))
    const nm = nameCol !== undefined ? norm(vals.get(nameCol)) : ''
    const hasData = visCols.some((c) => !labelCols.has(c) && meaningful(vals.get(c), c))
    const isTotal = /^итого/i.test(nm) || /^итого/i.test(code)
    data.push({ r, vals, code, name: nm, seg: codeSegments(code), hasData, isTotal, roman: isRoman(code) })
  }
  // структурные строки (этап/подэтап) без своих данных оставляем, только если ниже есть их «дети»
  const keptSegs = data.filter((d) => d.hasData && d.seg).map((d) => d.seg)
  for (const d of data) {
    d.keep =
      d.hasData ||
      (opts.finance && d.name && !PLACEHOLDER.test(d.name)) ||
      (d.seg && d.name && !PLACEHOLDER.test(d.name) && keptSegs.some((s) => isPrefix(d.seg, s)))
  }
  const kept = data.filter((d) => d.keep)
  if (textNums) notes.push({ level: 'info', text: `«${name}»: ${textNums} чисел были записаны текстом — приведены к числам` })

  // пустые столбцы (во всех оставленных строках) убираем, если и в шапке у них нет собственного текста
  const cols = visCols.filter(
    (c) => c === codeCol || c === nameCol || unitCols.includes(c) || opts.keepCol?.(sem.get(c)) || kept.some((d) => hasText(d.vals.get(c)) && meaningful(d.vals.get(c), c))
  )
  const header = buildHeader(ws, grid, headerRows, cols)
  const rows = kept.map((d) => {
    const level = d.seg ? d.seg.length : d.roman ? 0 : undefined
    const bold = d.isTotal || d.roman || /^этап/i.test(d.code) || (d.seg && d.seg.length === 1 && /этап/i.test(d.name))
    const out = { c: cols.map((c) => cellOut(d.vals.get(c))) }
    if (bold) out.b = true
    if (level !== undefined) out.l = level
    return out
  })
  return {
    name, caption, notes, header, rows,
    cols: cols.map((c) => colInfo(ws, c, numCols.has(c))),
    // для нормализации
    sem: cols.map((c) => sem.get(c)), kept, keptCols: cols, numCols, codeCol, nameCol,
  }
}

function cellOut(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && v.date) return ruDate(v.date)
  if (typeof v === 'number') return Math.round(v * 100) / 100
  const t = String(v).trim()
  return t === '' || PLACEHOLDER.test(norm(t)) ? null : t
}

function colInfo(ws, c, num) {
  const w = ws['!cols']?.[c]?.wch ?? (ws['!cols']?.[c]?.wpx ? ws['!cols'][c].wpx / 7 : 10)
  return num ? { w: Math.round(w), num: true } : { w: Math.round(w) }
}

// Шапка с объединениями, ограниченная оставленными столбцами. Объединение показывается в первой
// оставленной ячейке своего диапазона (его начало могло оказаться в отброшенном столбце).
function buildHeader(ws, grid, headerRows, cols) {
  const merges = ws['!merges'] ?? []
  return headerRows
    .map((r) =>
      cols
        .map((c) => {
          const m = merges.find((m) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c)
          if (!m) return { t: norm(grid[r][c]) }
          const anchorRow = headerRows.find((x) => x >= m.s.r && x <= m.e.r)
          const anchorCol = cols.find((x) => x >= m.s.c && x <= m.e.c)
          if (r !== anchorRow || c !== anchorCol) return null
          const out = { t: norm(grid[m.s.r][m.s.c]) }
          const cs = cols.filter((x) => x >= m.s.c && x <= m.e.c).length
          const rs = headerRows.filter((x) => x >= m.s.r && x <= m.e.r).length
          if (cs > 1) out.cs = cs
          if (rs > 1) out.rs = rs
          return out
        })
        .filter(Boolean)
    )
    .filter((row) => row.some((h) => h.t))
    // одинаковые соседние годы («2026 | 2026» над «Этап 1 | Этап 2») — одной ячейкой, как в Excel
    .map((row) =>
      row.reduce((acc, h) => {
        const prev = acc.at(-1)
        if (prev && !prev.rs && !h.rs && /^20\d\d$/.test(h.t) && prev.t === h.t) prev.cs = (prev.cs ?? 1) + (h.cs ?? 1)
        else acc.push({ ...h })
        return acc
      }, [])
    )
}

// ---------- нормализация ----------

function colBy(sheet, re) {
  const i = sheet.sem.findIndex((s) => re.test(s))
  return i >= 0 ? sheet.keptCols[i] : undefined
}
const val = (d, c) => (c === undefined ? null : d.vals.get(c))
const txt = (d, c) => {
  const v = val(d, c)
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && v.date) return v.date
  const t = norm(v)
  return PLACEHOLDER.test(t) ? '' : t
}
const numv = (v) => (typeof v === 'number' ? v : null)
const isDate = (v) => v && typeof v === 'object' && v.date

function yearCols(sheet) {
  return sheet.keptCols.map((c, i) => [c, (sheet.sem[i].match(/(^|\s)(20\d\d)(\s|$)/) ?? [])[2]]).filter(([, y]) => y)
}
// тыс. руб. → руб.
const mult = (unit) => (/тыс/i.test(unit) ? 1000 : 1)
const rubUnit = (unit) => (/руб/i.test(unit) ? 'руб.' : unit)

function normalizePlan(sheet) {
  const cName = colBy(sheet, /наименование этап/i)
  const cContent = colBy(sheet, /содержание/i)
  const cResults = colBy(sheet, /результат/i)
  const cExec = colBy(sheet, /исполнитель/i)
  const cStart = colBy(sheet, /начало/i)
  const cEnd = colBy(sheet, /окончание/i)
  return sheet.kept
    .filter((d) => d.seg && (txt(d, cName) || txt(d, cContent)))
    .map((d, i) => ({
      sort: i,
      code: d.code,
      level: d.seg.length,
      name: txt(d, cName),
      content: txt(d, cContent),
      results: txt(d, cResults),
      executor: txt(d, cExec),
      start_date: isDate(val(d, cStart)) ? val(d, cStart).date : null,
      end_date: isDate(val(d, cEnd)) ? val(d, cEnd).date : null,
    }))
}

function normalizeExpenses(sheet) {
  const cUnit = colBy(sheet, /ед\.? ?изм|единица/i)
  const cTotal = colBy(sheet, /^итого$/i)
  const years = yearCols(sheet)
  return sheet.kept.map((d, i) => {
    const unit = txt(d, cUnit)
    const k = mult(unit)
    const amounts = {}
    for (const [c, y] of years) if (numv(val(d, c)) !== null) amounts[y] = numv(val(d, c)) * k
    const total = numv(val(d, cTotal))
    return { sort: i, code: d.code, name: d.name, unit: rubUnit(unit), amounts, total: total === null ? null : total * k }
  })
}

// Закупки формы 2024: листы 5_ (работы, услуги) и 6_ (ПО, материалы, оборудование) по годам;
// категория — из строки-раздела (I, II, …). Листы 3_ и 4_ — не закупки, а параметры расчёта
// (количество командировок, сотрудников), поэтому сюда не идут.
function normalizePurchases2024(sheet) {
  const cUnit = colBy(sheet, /ед\.? ?изм|единица/i)
  const cPurpose = colBy(sheet, /цель/i)
  const cTotal = colBy(sheet, /^итого$/i)
  const cLink = colBy(sheet, /обоснован|дополнительная информация/i)
  const years = yearCols(sheet)
  const out = []
  let category = sheet.caption
  for (const d of sheet.kept) {
    if (d.roman || d.isTotal) {
      if (d.roman) category = d.name
      continue
    }
    if (!d.seg) continue
    const unit = txt(d, cUnit)
    const k = mult(unit)
    const amounts = {}
    for (const [c, y] of years) if (numv(val(d, c))) amounts[y] = numv(val(d, c)) * k
    const total = numv(val(d, cTotal))
    out.push({
      sheet: sheet.name, category, object_type: '', substage_code: '', name: d.name, purpose: txt(d, cPurpose),
      unit: rubUnit(unit), amounts, total: total === null ? null : total * k, justification: txt(d, cLink),
    })
  }
  return out
}

// Закупки формы 2025: «МТО,раб,усл» — у каждой позиции подэтап, цена — средняя из трёх КП
function normalizePurchases2025(sheet) {
  const cSub = colBy(sheet, /номер этапа/i)
  const cKind = colBy(sheet, /вид закупки/i)
  const cType = colBy(sheet, /тип объекта/i)
  const cPurpose = colBy(sheet, /цель/i)
  const cUnit = colBy(sheet, /ед\.? ?изм/i)
  const cAvg = colBy(sheet, /средняя стоимость/i)
  const cJust = sheet.keptCols.filter((c, i) => /обоснование/i.test(sheet.sem[i]))
  return sheet.kept
    .filter((d) => d.seg && d.seg.length >= 3 && d.hasData)
    .map((d) => ({
      sheet: sheet.name,
      category: txt(d, cKind),
      object_type: txt(d, cType),
      substage_code: txt(d, cSub).replace(/^подэтап\s*/i, ''),
      name: PLACEHOLDER.test(d.name) ? '' : d.name,
      purpose: txt(d, cPurpose),
      unit: rubUnit(txt(d, cUnit)),
      amounts: {},
      total: numv(val(d, cAvg)),
      justification: cJust.map((c) => txt(d, c)).filter(Boolean).join('; '),
    }))
}

// «План по этапам» (форма 2025): суммы строки по годам и по этапам из столбцов «год × этап»
function stageMatrix(sheet) {
  const cells = sheet.keptCols
    .map((c, i) => {
      const m = sheet.sem[i].match(/(20\d\d)\s+Этап\s*(\d+)/i)
      return m ? { c, y: m[1], n: Number(m[2]) } : null
    })
    .filter(Boolean)
  return sheet.kept.map((d) => {
    const byYear = {}
    const byStage = {}
    for (const x of cells) {
      const v = numv(val(d, x.c))
      if (v === null) continue
      byYear[x.y] = (byYear[x.y] ?? 0) + v
      byStage[x.n] = (byStage[x.n] ?? 0) + v
    }
    return { code: d.code, name: d.name, byYear, byStage }
  })
}

// «Расходы» формы 2024 на сайте: тыс. руб. → руб., над годом — номер этапа (этап = год)
function expensesToRublesWithStages(sheet) {
  const unitIdx = sheet.sem.findIndex((t) => /единица|ед\.? ?изм/i.test(t))
  const years = sheet.sem.map((t) => (t.match(/^(20\d\d)$/) ?? [])[1]).filter(Boolean)
  for (const hr of sheet.header) for (const h of hr) if (years.includes(h.t)) h.t = `Этап ${years.indexOf(h.t) + 1} (${h.t})`
  if (unitIdx < 0) return
  sheet.rows.forEach((r, i) => {
    if (!/тыс/i.test(String(r.c[unitIdx] ?? ''))) return
    // пересчёт из исходных значений (в r.c они уже округлены до копеек тысяч)
    const d = sheet.kept[i]
    r.c = r.c.map((v, j) => {
      const raw = d.vals.get(sheet.keptCols[j])
      return j > unitIdx && typeof raw === 'number' ? Math.round(raw * 1000 * 100) / 100 : v
    })
    r.c[unitIdx] = 'руб.'
  })
}

// ---------- проверки ----------

// ИТОГО строки = сумма по годам. Только денежные строки: у средних величин, цен и количеств
// в «ИТОГО» стоит среднее, а не сумма.
function checkRowTotals(sheet, checks) {
  const cTotal = colBy(sheet, /^итого$/i)
  const cUnit = colBy(sheet, /ед\.? ?изм|единица/i)
  const years = yearCols(sheet)
  if (cTotal === undefined || years.length < 2) return
  let section = ''
  for (const d of sheet.kept) {
    if (d.roman) section = d.name
    const avg = /средн|стоимость 1|на 1 |цена|суточн|количеств/i
    if (!/руб/i.test(txt(d, cUnit)) || avg.test(d.name) || avg.test(section)) continue
    const t = numv(val(d, cTotal))
    const ys = years.map(([c]) => numv(val(d, c)))
    if (t === null || ys.some((y) => y === null)) continue
    const sum = ys.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - t) > 1 && Math.abs(sum - t) / Math.max(1, Math.abs(t)) > 1e-6) {
      // Шаблон ФЭО 2025 года: «ИТОГО» статьи I в «Плане по этапам» прибавляет этап 1 дважды — так в 22
      // файлах из 25, исполнители тут ни при чём, на суммы этапов не влияет. Такое — справкой, не предупреждением.
      const stage1 = numv(val(d, colBy(sheet, /^Этап\s*1$/i)))
      const templateBug = sheet.name === 'План по этапам' && d.code === 'I' && stage1 !== null && Math.abs(t - sum - stage1) <= 1
      checks.push(
        templateBug
          ? { level: 'info', text: `«${sheet.name}», статья I: в столбце «ИТОГО» ${fmt(t)} вместо ${fmt(sum)} — ошибка формулы шаблона ФЭО (этап 1 учтён дважды), на суммы этапов не влияет` }
          : { level: 'warn', text: `«${sheet.name}», строка «${d.name || d.code}»: в столбце «ИТОГО» ${fmt(t)}, а сумма по ${sheet.name === 'План по этапам' ? 'годам и этапам' : 'годам'} ${fmt(sum)} — ошибка формулы в файле` }
      )
    }
  }
}
const fmt = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)

// ---------- план НИОКР из ТЗ ----------
// План этапов берётся не из ФЭО, а из технического задания (Word): таблица «Этапы реализации НИОКР»
// — № / наименование этапа и подэтапов с содержанием работ / результаты / сроки (начало, окончание).
// Показываем наименование с содержанием, результаты (подтверждающие документы) и сроки.

// Пути к папкам с ТЗ — в .env.local (FEO_TZ_DIR_2024, FEO_PROJECTS_DIR_2025), чтобы не светить их в публичном репо
const TZ_DIR_2024 = env.FEO_TZ_DIR_2024 || ''

// 3 волна: итоговые ТЗ — только PDF-сканы, поэтому Word берём из папки проекта («<номер>. <код> <исполнитель>\ТЗ … .docx»)
const PROJECTS_DIR_2025 = env.FEO_PROJECTS_DIR_2025 || ''
if (!TZ_DIR_2024 || !PROJECTS_DIR_2025) console.warn('⚠ FEO_TZ_DIR_2024 / FEO_PROJECTS_DIR_2025 не заданы в .env.local — план НИОКР будет взят из ФЭО, а не из ТЗ')

// 1–2 волна: ТЗ в Word названы по-разному («1.2_<код>_<исполнитель>», «1.6. <код>_…»), поэтому
// сопоставляем по номеру проекта из имени файла ФЭО («1.12 <код>_<исполнитель>.xlsx» → «1.12»).
function findTz(project, template, feoFile) {
  const code = project.code.toLowerCase()
  const isDocx = (n) => /\.docx$/i.test(n) && !n.startsWith('~$')
  if (template === '2024') {
    if (!fs.existsSync(TZ_DIR_2024)) return null
    const num = path.basename(feoFile).match(/^(\d+\.\d+)/)?.[1]
    const byNum = num && new RegExp(`^${num.replace('.', '\\.')}(?!\\d)`)
    const f = fs
      .readdirSync(TZ_DIR_2024)
      .find((n) => isDocx(n) && (byNum ? byNum.test(n) : n.toLowerCase().replace(/^[\d.\s_]+/, '').startsWith(code)))
    return f ? path.join(TZ_DIR_2024, f) : null
  }
  if (!fs.existsSync(PROJECTS_DIR_2025)) return null
  // папки названы не строго по шифру: «6. Улей ИТК» (Улей-25), «3. LOT3-… (КАРУСЕЛЬ) …»
  const base = code.replace(/-\d+$/, '')
  const dirs = fs.readdirSync(PROJECTS_DIR_2025).filter((n) => !n.startsWith('_'))
  const dir =
    dirs.find((n) => n.toLowerCase().replace(/^[\d.\s]+/, '').startsWith(code)) ??
    dirs.find((n) => n.toLowerCase().includes(base))
  if (!dir) return null
  const f = fs.readdirSync(path.join(PROJECTS_DIR_2025, dir)).find((n) => isDocx(n) && /^ТЗ/i.test(n))
  return f ? path.join(PROJECTS_DIR_2025, dir, f) : null
}

const xmlText = (s) =>
  s
    .split(/<\/w:p>/)
    .map((p) =>
      p.replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
    )
    .filter(Boolean)
// «31.12.2024» / «19.11.25» → «2024-12-31»; несуществующая дата (в ТЗ встречается «31.09.2027») → null
// в ТЗ встречаются «31.12. 2024», «01.01.\n2026», «31.7.2027», «19.11.25»
const DATE_RE = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4}|\d{2})(?!\d)/
function ruToIso(s) {
  const m = String(s).match(DATE_RE)
  if (!m) return null
  const iso = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}

const isCodeText = (t) => /^\d+(\.\d+)*\.?$/.test(String(t ?? '').trim())
const isStageText = (t) => /^этап\s*\d+/i.test(String(t ?? '').trim())

// Таблица этапов ТЗ. Исполнители оформляли её по-разному, поэтому строки разбираются по смыслу:
//  · этап — строка с «Этап N…» (с номером «1» или отдельной строкой без номера), а если таких нет —
//    строка с целым номером «1»;
//  · подэтап — строка с номером «1.1», а если номеров нет или они сквозные («1., 2., …» внутри «Этап 1»),
//    номер «этап.порядковый» присваиваем сами;
//  · строка без номера, результатов и сроков сразу после этапа — продолжение описания этапа;
//  · «Подэтап 3.2 …» в тексте важнее номера строки (у «Авроры» он стоит под № 4);
//  · строка нумерации столбцов «1 | 2 | 5 | 6» пропускается.
// Столбцы ищутся по шапке: наименование, содержание (если отдельно), результаты, исполнитель; сроки —
// последние две ячейки (в строках с объединёнными ячейками — те из них, что похожи на даты).
function parseStageTable(rows) {
  const first = (r) => (r[0] ?? []).join(' ').trim()
  const isNumbering = (r) => {
    const vals = r.map((c) => c.join(' ').trim()).filter(Boolean)
    return vals.length >= 3 && vals.every((v) => /^\d+$/.test(v)) && vals.every((v, i) => i === 0 || Number(v) > Number(vals[i - 1]))
  }
  const headerEnd = rows.findIndex((r) => !isNumbering(r) && (isCodeText(first(r)) || isStageText(first(r)) || r.some((c) => isStageText(c.join(' ')))))
  if (headerEnd <= 0) return []
  const h0 = rows[0].map((c) => c.join(' ').toLowerCase())
  const hasCode = /№|номер/.test(h0[0] ?? '')
  const nameCol = h0.findIndex((t) => /наименован|содержан/.test(t))
  const contentCol = h0.findIndex((t, i) => i !== nameCol && /содержан/.test(t))
  const resCol = h0.findIndex((t) => /результат/.test(t))
  const fullWidth = Math.max(...rows.slice(0, headerEnd).map((r) => r.length))
  // сроки — с первого столбца «Сроки…/Дата…» до конца строки (бывает один столбец, бывает «начало | окончание»)
  const dateCol = h0.findIndex((t) => /срок|дата|начал/.test(t))
  if (nameCol < 0) return []
  const textStages = rows.slice(headerEnd).some((r) => r.filter((c) => c.length).length <= 2 && r.some((c) => isStageText(c.join(' '))) && !isCodeText(first(r)))

  const items = []
  let stage = 0
  let seq = 0
  for (const r of rows.slice(headerEnd)) {
    if (isNumbering(r)) continue
    const cells = r.map((c) => c.join('\n').trim())
    if (!cells.some(Boolean)) continue
    const full = cells.length >= fullWidth
    // номер — только если первая ячейка действительно номер (а не «Этап 1. …» во всю ширину)
    const rawCode = hasCode && isCodeText(cells[0]) ? cells[0].replace(/\.$/, '') : ''
    let nameCell = [cells[nameCol], full && contentCol >= 0 ? cells[contentCol] : ''].filter(Boolean).join('\n')
    const stageCell = cells.find((t) => isStageText(t))
    // номер подэтапа в тексте: «Подэтап 3.2 …» (всегда) или «1.3 …» (когда столбца с номером нет)
    const codeInText = nameCell.match(/^подэтап\s*(\d+(?:\.\d+)+)\.?\s*/i) ?? (!rawCode ? nameCell.match(/^(\d+(?:\.\d+)+)\.?\s+/) : null)
    const subCode = codeInText?.[1]
    if (codeInText && !/^подэтап/i.test(codeInText[0])) nameCell = nameCell.slice(codeInText[0].length)
    // в строке с объединёнными ячейками столбцы сдвигаются — результаты берём только из полной строки
    const results = resCol >= 0 && full ? (cells[resCol] ?? '') : ''
    const dateLike = (t) => DATE_RE.test(t) || /дат|подписан|20\d\d|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр/i.test(t)
    const dateCells =
      full && dateCol >= 0
        ? cells.slice(dateCol).filter(Boolean)
        : cells.slice(1).slice(-2).filter((t) => t && dateLike(t) && t !== nameCell)
    const hasDates = dateCells.length > 0
    let kind
    let code
    let text = nameCell
    if (subCode) {
      kind = 'item'
      code = subCode
      stage = Number(subCode.split('.')[0])
    } else if (stageCell && (!rawCode || /^\d+$/.test(rawCode))) {
      kind = 'stage'
      stage = Number(stageCell.match(/этап\s*(\d+)/i)[1])
      code = String(stage)
      text = nameCell && isStageText(nameCell) ? nameCell : stageCell
    } else if (/^\d+$/.test(rawCode) && !textStages) {
      kind = 'stage'
      stage = Number(rawCode)
      code = rawCode
    } else if (textStages && cells.length === 1 && items.length) {
      // строка во всю ширину без «Этап N» между этапами (встречается в ТЗ 3 волны) — следующий этап
      kind = 'stage'
      stage += 1
      code = String(stage)
    } else if (/^\d+(\.\d+)+$/.test(rawCode)) {
      kind = 'item'
      code = rawCode
      stage = Number(rawCode.split('.')[0])
    } else {
      const prev = items.at(-1)
      if (prev?.kind === 'stage' && !results && !hasDates && !rawCode) {
        prev.text = [prev.text, nameCell].filter(Boolean).join('\n')
        continue
      }
      kind = 'item'
      code = `${stage}.${++seq}`
    }
    if (kind === 'stage') seq = 0
    else seq = Math.max(seq, Number(code.split('.')[1]) || 0)
    // сроки: две ячейки «начало | окончание», одна ячейка-диапазон «25.12.2025 - 01.11.2026» или текст
    let start = dateCells[0] ?? ''
    let end = dateCells.length > 1 ? dateCells.at(-1) : ''
    if (dateCells.length === 1) {
      const ds = start.match(new RegExp(DATE_RE.source, 'g')) ?? []
      if (ds.length === 2) [start, end] = ds
    }
    items.push({ kind, code, text: text.replace(/^-\s*/, ''), results, start, end })
  }
  // у этапа без своих сроков (сроки указаны в строках подэтапов) — начало первого и окончание последнего
  items.forEach((it, i) => {
    if (it.kind !== 'stage' || it.start || it.end) return
    const next = items.findIndex((x, j) => j > i && x.kind === 'stage')
    const subs = items.slice(i + 1, next < 0 ? undefined : next)
    it.start = subs.find((x) => x.start)?.start ?? ''
    it.end = [...subs].reverse().find((x) => x.end)?.end ?? ''
  })
  return items
}

function parseTz(file) {
  const cfb = XLSX.CFB.read(fs.readFileSync(file), { type: 'buffer' })
  const entry = XLSX.CFB.find(cfb, '/word/document.xml')
  if (!entry) return null
  const xml = Buffer.from(entry.content).toString('utf8')
  // Таблица этапов: в шапке «Наименование этапа(ов)» или «Содержание работ» и сроки/даты. Слова в Word
  // бывают разбиты по фрагментам («Наименованиеэтапов»), поэтому сравниваем без пробелов. Если таких
  // таблиц несколько (краткая по этапам + подробная), берём ту, где больше разобранных строк.
  const items =
    xml
      .split(/<w:tbl>/)
      .slice(1)
      .map((t) => t.split('</w:tbl>')[0])
      .filter((t) => {
        const plain = t.replace(/<[^>]+>/g, '').replace(/\s+/g, '').toLowerCase()
        return /наименованиеэтап|содержаниеработ/.test(plain) && /срок|датаначала/.test(plain)
      })
      .map((t) => parseStageTable(t.split('</w:tr>').slice(0, -1).map((tr) => tr.split('</w:tc>').slice(0, -1).map(xmlText))))
      .sort((a, b) => b.length - a.length)[0] ?? []
  if (!items.some((i) => i.kind === 'stage')) return null

  const plan = []
  const badDates = new Map() // «31.09.2027» → пункты ТЗ
  const sheetRows = items.map((it, i) => {
    const lines = it.text.split('\n')
    const level = it.kind === 'stage' ? 1 : it.code.split('.').length
    for (const d of [it.start, it.end]) if (DATE_RE.test(d) && !ruToIso(d)) badDates.set(d, [...(badDates.get(d) ?? []), it.code])
    plan.push({
      sort: i, code: it.code, level, name: lines[0] ?? '', content: lines.slice(1).join('\n'), results: it.results, executor: '',
      start_date: ruToIso(it.start), end_date: ruToIso(it.end),
    })
    const out = { c: [it.code, it.text, it.results || null, it.start || null, it.end || null], l: level }
    if (level === 1) out.b = true
    return out
  })
  const notes = [...badDates].map(([d, codes]) => ({
    level: 'warn',
    text: `ТЗ: несуществующая дата «${d}» (пункт${codes.length > 1 ? 'ы' : ''} ${codes.join(', ')}) — в плане показана как в ТЗ`,
  }))
  return {
    plan,
    notes,
    sheet: {
      name: 'План НИОКР (ТЗ)',
      caption: `Этапы реализации НИОКР — по техническому заданию («${path.basename(file)}»)`,
      cols: [{ w: 6 }, { w: 80 }, { w: 36 }, { w: 14 }, { w: 14 }],
      header: [
        [
          { t: '№ п/п', rs: 2 },
          { t: 'Наименование этапа и подэтапов, содержание работ', rs: 2 },
          { t: 'Результаты (подтверждающие документы)', rs: 2 },
          { t: 'Сроки выполнения', cs: 2 },
        ],
        [{ t: 'начало' }, { t: 'окончание' }],
      ],
      rows: sheetRows,
    },
  }
}

// ---------- проект по имени файла ----------

const { data: projects, error: pErr } = await sb.from('projects').select('id, number, code, stages:project_stages(stage_number, start_date, end_date, cost)')
if (pErr) throw pErr
function findProject(file) {
  const base = path.basename(file, path.extname(file))
  if (/^\d{3,5}$/.test(base)) return projects.find((p) => String(p.number) === base)
  const code = base.replace(/^\d+\.\d+\s+/, '').split('_')[0].trim().toLowerCase()
  return projects.find((p) => p.code.toLowerCase() === code)
}

// ---------- основной цикл ----------

for (const file of files) {
  const project = findProject(file)
  if (!project) {
    console.log(`\n✗ ${path.basename(file)}: не нашёл проект по имени файла — пропускаю`)
    continue
  }
  const wb = XLSX.readFile(file, { cellStyles: true, cellDates: false })
  const hiddenSheets = new Set((wb.Workbook?.Sheets ?? []).filter((s) => s.Hidden).map((s) => s.name))
  const template = wb.SheetNames.includes('П_05_ПЛАН_НИОКР') ? '2024' : wb.SheetNames.some((s) => /^План выполн/.test(s)) ? '2025' : null
  if (!template) {
    console.log(`\n✗ ${path.basename(file)}: неизвестная форма ФЭО (листы: ${wb.SheetNames.join(', ')})`)
    continue
  }
  const checks = []
  const sheets = []
  // «План по этапам»: столбцы «год × этап» оставляем по срокам этапа в базе (этап на стыке лет —
  // два столбца), даже если в одном из них нули
  const stageSpansYear = (y, n) => {
    const st = project.stages.find((x) => x.stage_number === n)
    if (!st?.start_date) return false
    return Number(st.start_date.slice(0, 4)) <= y && y <= Number((st.end_date ?? st.start_date).slice(0, 4))
  }
  const keepStageCol = (sem) => {
    const m = sem.match(/(20\d\d)\s+Этап\s*(\d+)/i)
    return m ? stageSpansYear(Number(m[1]), Number(m[2])) : /^Этап\s*\d+$/i.test(sem)
  }
  for (const name of wb.SheetNames) {
    if (hiddenSheets.has(name) || SKIP_SHEETS.test(name)) continue
    const opts = FINANCE_SHEETS.test(name) ? { finance: true, keepCol: name === 'План по этапам' ? keepStageCol : undefined } : {}
    const s = cleanSheet(name, wb.Sheets[name], opts)
    if (!s || (!s.rows.length && !s.plain)) continue
    checks.push(...s.notes)
    sheets.push(s)
  }

  // «Основная информация» → пары «подпись: значение» (первая и последняя непустые ячейки строки)
  const infoSheet = sheets.find((s) => s.name === 'Основная информация')
  const info = []
  if (infoSheet) {
    for (const row of infoSheet.rows) {
      const vals = row.c.filter((v) => v !== null)
      // ставка ВБФ и «срок реализации … (мес.)» (в ФЭО там нули) не нужны
      if (vals.length === 2 && typeof vals[0] === 'string' && /[а-я]/i.test(vals[0]) && !/^\d/.test(vals[0]) && !/ставка|срок реализации/i.test(vals[0])) {
        info.push({ label: vals[0].replace(/\s*:\s*$/, ''), value: String(vals[1]) })
      }
    }
  }

  // нормализация. План НИОКР — из ТЗ; на сайте из листов ФЭО — только деньги: «Расходы» (2024),
  // «План по годам» и «План по этапам» (2025). Закупки (5_/6_ или «МТО,раб,усл») идут в сводку.
  const tzFile = findTz(project, template, file)
  const tz = tzFile ? parseTz(tzFile) : null
  if (tz) checks.push(...tz.notes)
  // у части проектов ТЗ только в PDF или ТЗ нет вовсе
  if (!tz) checks.push({ level: 'info', text: 'ТЗ в Word не найдено (есть только PDF или ТЗ нет) — план НИОКР взят из ФЭО' })
  const planSheet = sheets.find((s) => /ПЛАН_НИОКР|^План выполн/.test(s.name))
  const expSheet = sheets.find((s) => s.name === (template === '2024' ? 'Расходы' : 'План по годам'))
  const plan = tz?.plan ?? (planSheet ? normalizePlan(planSheet) : [])
  const shown = sheets.filter((s) => (template === '2024' ? s.name === 'Расходы' : /^План по (годам|этапам)$/.test(s.name)))
  if (template === '2024' && expSheet) expensesToRublesWithStages(expSheet)
  const expenses = expSheet ? normalizeExpenses(expSheet) : []
  const purchases =
    template === '2024'
      ? sheets.filter((s) => /^[56]_/.test(s.name)).flatMap(normalizePurchases2024)
      : sheets.filter((s) => /^МТО/.test(s.name)).flatMap(normalizePurchases2025)
  purchases.forEach((p, i) => (p.sort = i))

  // проверки — только по показываемым листам (+ сверка итога с базой)
  const shownChecks = checks.filter((c) => c.level === 'warn' || shown.some((s) => c.text.includes(`«${s.name}»`)))
  checks.length = 0
  checks.push(...shownChecks)
  for (const s of shown) if (!s.plain) checkRowTotals(s, checks)
  // сверка с базой — по этапам (сумма этапа в ФЭО против стоимости этапа в базе)
  const stageCost = (n) => Number(project.stages.find((x) => x.stage_number === n)?.cost ?? NaN)
  const total = expenses.find((e) => /итого стоимость/i.test(e.name))
  const compareStage = (n, feo) => {
    const db = stageCost(n)
    if (!Number.isNaN(db) && Math.abs(feo - db) > 5) {
      checks.push({ level: 'warn', text: `Этап ${n}: в ФЭО ${fmt(feo)} ₽, в базе ${fmt(db)} ₽ (разница ${fmt(feo - db)} ₽)` })
    }
  }
  if (template === '2024' && total) {
    // 1–2 волна: этап = году ФЭО
    Object.keys(total.amounts).sort().forEach((y, i) => compareStage(i + 1, total.amounts[y]))
  }
  if (template === '2025') {
    const byStages = sheets.find((s) => s.name === 'План по этапам')
    const matrix = byStages ? stageMatrix(byStages) : []
    const mTotal = matrix.find((m) => /итого стоимость/i.test(m.name))
    if (mTotal) for (const [n, v] of Object.entries(mTotal.byStage)) compareStage(Number(n), v)
    // «План по годам» против «Плана по этапам»: по каждой статье и году (этап на стыке лет
    // раскладывается по годам, поэтому сравниваем суммы года по всем этапам)
    for (const e of expenses) {
      if (!(isRoman(e.code) || /итого стоимость/i.test(e.name))) continue
      const m = matrix.find((x) => x.code === e.code && x.name === e.name)
      if (!m) continue
      for (const y of new Set([...Object.keys(e.amounts), ...Object.keys(m.byYear)])) {
        const a = e.amounts[y] ?? 0
        const b = m.byYear[y] ?? 0
        if (Math.abs(a - b) > 5) {
          checks.push({
            level: 'warn',
            text: `${e.code ? `Статья ${e.code} «${e.name}»` : `«${e.name}»`}, ${y} год: в «Плане по годам» ${fmt(a)} ₽, в «Плане по этапам» ${fmt(b)} ₽ (разница ${fmt(b - a)} ₽)`,
          })
        }
      }
    }
  }

  const stat = fs.statSync(file)
  const doc = {
    project_id: project.id,
    template,
    file_name: path.basename(file),
    source_path: path.resolve(file),
    file_modified_at: stat.mtime.toISOString(),
    info,
    checks,
  }
  const sheetRows = [...(tz ? [tz.sheet] : []), ...shown].map((s, i) => ({ sort: i, name: s.name, caption: s.caption, cols: s.cols, header: s.header, rows: s.rows }))

  console.log(`\n✓ ${path.basename(file)} → №${project.number} ${project.code} (форма ${template})`)
  for (const s of sheetRows) console.log(`   лист «${s.name}»: ${s.rows.length} строк × ${s.cols.length} столбцов`)
  console.log(`   подэтапов плана ${plan.length}, статей расходов ${expenses.length}, закупок ${purchases.length}, сведений ${info.length}`)
  for (const c of checks) console.log(`   ${c.level === 'warn' ? '⚠' : '·'} ${c.text}`)

  const previewDir = new URL('../private/feo-preview/', import.meta.url)
  fs.mkdirSync(previewDir, { recursive: true })
  fs.writeFileSync(new URL(`${project.number}.json`, previewDir), JSON.stringify({ doc, sheets: sheetRows, plan, expenses, purchases }, null, 1))

  if (!apply) continue
  const { error: delErr } = await sb.from('feo_documents').delete().eq('project_id', project.id)
  if (delErr) throw delErr
  const { data: inserted, error: insErr } = await sb.from('feo_documents').insert(doc).select('id').single()
  if (insErr) throw insErr
  const withDoc = (arr) => arr.map((x) => ({ ...x, document_id: inserted.id }))
  for (const [table, rows] of [['feo_sheets', sheetRows], ['feo_plan_items', plan], ['feo_expenses', expenses], ['feo_purchases', purchases]]) {
    if (!rows.length) continue
    const { error } = await sb.from(table).insert(withDoc(rows))
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log('   записано в базу')
}
if (!apply) console.log('\nСухой прогон. Превью — private/feo-preview/*.json. Для записи добавь --apply')

const WEEKDAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
const MONTH_NAMES = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

function iso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * "Сегодня" по московскому времени, как обычная локальная дата (без времени).
 * На Vercel серверные функции работают в UTC — обычный `new Date()` + `toISOString()`
 * в течение ~21:00–23:59 UTC (0:00–2:59 по Москве) показывал бы вчерашний день.
 */
export function getBusinessToday(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year')!.value)
  const m = Number(parts.find((p) => p.type === 'month')!.value)
  const d = Number(parts.find((p) => p.type === 'day')!.value)
  return new Date(y, m - 1, d)
}

// 0 = понедельник … 6 = воскресенье (в отличие от Date#getDay, где 0 = воскресенье)
function mondayFirstIndex(d: Date) {
  return (d.getDay() + 6) % 7
}

function addDays(base: Date, n: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function addMonthsClamped(base: Date, n: number) {
  const targetMonthTotal = base.getMonth() + n
  const targetYear = base.getFullYear() + Math.floor(targetMonthTotal / 12)
  const targetMonth = ((targetMonthTotal % 12) + 12) % 12
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const day = Math.min(base.getDate(), lastDayOfTargetMonth)
  return new Date(targetYear, targetMonth, day)
}

function lastDayOfMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

// Для каждого дня недели — первая и последняя дата (число месяца), когда он выпадает в этом месяце.
function monthWeekdayTable(year: number, monthIndex0: number) {
  const lastDay = lastDayOfMonth(year, monthIndex0)
  const firstByWd: (number | null)[] = new Array(7).fill(null)
  const lastByWd: (number | null)[] = new Array(7).fill(null)
  for (let day = 1; day <= lastDay; day++) {
    const wd = mondayFirstIndex(new Date(year, monthIndex0, day))
    if (firstByWd[wd] === null) firstByWd[wd] = day
    lastByWd[wd] = day
  }
  return { firstByWd, lastByWd }
}

/**
 * Готовые, посчитанные кодом (а не LLM) даты-ориентиры для промпта: ближайшие дни недели,
 * смещения на N дней/недель/месяцев и таблица первых/последних дней недели по месяцам.
 * Идея — не заставлять модель считать даты в уме (частый источник ошибок), а дать ей
 * готовую таблицу для сопоставления с формулировкой пользователя.
 */
export function buildDateContext(today: Date): string {
  const todayISO = iso(today)

  const nextWeekdayLines = WEEKDAY_NAMES.map((name, idx) => {
    const todayIdx = mondayFirstIndex(today)
    let diff = idx - todayIdx
    if (diff <= 0) diff += 7 // ближайшее будущее вхождение, не сегодня
    return `  - ${name} → ${iso(addDays(today, diff))}`
  }).join('\n')

  const offsetLines = [
    ['через 1 день', 1], ['через 2 дня', 2], ['через 3 дня', 3],
    ['через 5 дней', 5], ['через неделю / через 1 неделю', 7],
    ['через 2 недели', 14], ['через 3 недели', 21], ['через 4 недели', 28],
  ]
    .map(([label, n]) => `  - ${label} → ${iso(addDays(today, n as number))}`)
    .join('\n')

  const monthOffsetLines = [1, 2, 3]
    .map((n) => `  - через ${n} ${n === 1 ? 'месяц' : 'месяца'} → ${iso(addMonthsClamped(today, n))}`)
    .join('\n')

  // Таблица первых/последних дней недели для текущего и трёх следующих месяцев —
  // покрывает запросы вида "последняя суббота сентября", "первый понедельник ноября".
  const monthTables = [0, 1, 2, 3]
    .map((offset) => {
      const d = addMonthsClamped(new Date(today.getFullYear(), today.getMonth(), 1), offset)
      const { firstByWd, lastByWd } = monthWeekdayTable(d.getFullYear(), d.getMonth())
      const rows = WEEKDAY_NAMES.map((name, idx) => {
        const first = firstByWd[idx]
        const last = lastByWd[idx]
        const firstISO = first ? iso(new Date(d.getFullYear(), d.getMonth(), first)) : '—'
        const lastISO = last ? iso(new Date(d.getFullYear(), d.getMonth(), last)) : '—'
        return `    ${name}: первый ${firstISO}, последний ${lastISO}`
      }).join('\n')
      const lastDayISO = iso(new Date(d.getFullYear(), d.getMonth(), lastDayOfMonth(d.getFullYear(), d.getMonth())))
      return `  ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} (последний день месяца: ${lastDayISO}):\n${rows}`
    })
    .join('\n')

  return `Сегодня: ${todayISO}.

Готовые ориентиры для перевода сроков в формат YYYY-MM-DD (бери значение отсюда, если формулировка совпадает по смыслу — не вычисляй такие даты самостоятельно, здесь меньше риск ошибиться):

Ближайшее вхождение дня недели (если день недели назван без уточнения "следующий" — обычно имеется в виду вот эта, ближайшая будущая дата):
${nextWeekdayLines}

Смещение от сегодня:
${offsetLines}
${monthOffsetLines}

Первый/последний день недели по месяцам (для формулировок вида "первая/последняя <день недели> <месяц>"):
${monthTables}

Если формулировка не совпадает ни с чем из таблиц выше (например, названа конкретная дата вроде "15 сентября", "конец месяца", "начало следующего месяца", "в следующий четверг" через неделю после ближайшего) — посчитай сам, отталкиваясь от сегодняшней даты (${todayISO}) и дня недели сегодня.`
}

import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import type { Project, ProjectClaim, ProjectContract, ProjectPayment } from '@/types'

// Экспорт «в формате мега-таблицы» (см. private/Мега_таблица_договоры_НИОКР…xlsx, листы «Проекты» и
// «Платежи») — те же заголовки колонок, чтобы файл можно было позже прогнать через тот же импорт-скрипт
// обратно. project_id (P0xx) — внутренний ключ ТОЛЬКО этой книги (связывает Проекты↔Платежи между
// собой); при повторном импорте matching всё равно идёт по "ID PM" = наш projects.number. Данные,
// которых у нас нет (РИД, тема НИОКР по ТЗ и т.п.) или которые сознательно не храним (личные контакты,
// партнёры) — оставлены пустыми, не выдумываем.

const SELECT =
  '*, contracts:project_contracts(*), stages:project_stages(*, claims:project_claims(*)), payments:project_payments(*)'

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Продолжаем',
  terminating: 'Отменяем',
  terminated: 'Прекращен',
}

function formatDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : ''
}

// Мега-таблица хранит доп.соглашения одной текстовой ячейкой, несколько — через перевод строки;
// у нас это список [{number, date}], собираем обратно в тот же текстовый формат для экспорта.
function formatAdditionalAgreements(list: { number: string; date: string | null }[] | undefined) {
  return (list ?? []).map((a) => `№ ${a.number} от ${formatDate(a.date)}`).join('\n')
}

function formatRub(n: number | null | undefined) {
  return n ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) : ''
}

// Требования о возврате хранятся в project_claims (по этапу их может быть несколько, редко —
// обычно 0-1); для мега-таблицы, где нет отдельного листа под это, сводим в одну ячейку текстом,
// несколько требований на этапе — через перевод строки, как и доп.соглашения.
function formatClaims(claims: ProjectClaim[] | undefined) {
  return (claims ?? [])
    .map((c) => {
      const sum = (Number(c.claim_balance) || 0) + (Number(c.claim_misuse_amount) || 0) + (Number(c.claim_noncompliance_amount) || 0)
      const head = `№ ${c.claim_number || '—'} от ${formatDate(c.claim_date)}: ${formatRub(sum)} ₽` +
        ` (остаток ${formatRub(c.claim_balance)}, нецелевой расход ${formatRub(c.claim_misuse_amount)}, несоответствие ${formatRub(c.claim_noncompliance_amount)})`
      const payments = c.claim_execution_payments ?? []
      if (payments.length === 0) return head + ' — не исполнено'
      const execText = payments.map((p) => `${formatDate(p.date)} — ${formatRub(p.amount)} ₽`).join('; ')
      return `${head} — исполнено: ${execText}`
    })
    .join('\n')
}

function contractFor(contracts: ProjectContract[], year: number) {
  return contracts.find((c) => c.contract_year === year)
}

function lotNumber(lotLabel: string) {
  const m = lotLabel.match(/\d+/)
  return m ? m[0] : lotLabel
}

function sumBy(payments: ProjectPayment[], year: number, field: 'obligation_amount' | 'paid_amount') {
  return payments.filter((p) => p.plan_year === year).reduce((acc, p) => acc + (Number(p[field]) || 0), 0)
}

export async function GET() {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase.from('projects').select(SELECT).order('number', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const projects = (data as Project[]) ?? []

  const externalId = (p: Project) => p.external_project_id || `P${p.number}`

  // ---------- Лист «Проекты» ----------
  const projectRows = projects.map((p) => {
    const contracts = p.contracts ?? []
    const stages = [...(p.stages ?? [])].sort((a, b) => a.stage_number - b.stage_number)
    const payments = p.payments ?? []
    const c2024 = contractFor(contracts, 2024)
    const c2025 = contractFor(contracts, 2025)
    const c2026 = contractFor(contracts, 2026)

    const stage = (n: number) => stages.find((s) => s.stage_number === n)
    const grantTotal = stages.reduce((acc, s) => acc + (Number(s.cost) || 0), 0)

    const years = [2024, 2025, 2026, 2027]
    const obligationByYear = Object.fromEntries(years.map((y) => [y, sumBy(payments, y, 'obligation_amount')]))
    const paidByYear = Object.fromEntries(years.map((y) => [y, sumBy(payments, y, 'paid_amount')]))
    const totalObligation = years.reduce((a, y) => a + obligationByYear[y], 0)
    const totalPaid = years.reduce((a, y) => a + paidByYear[y], 0)

    return {
      project_id: externalId(p),
      'Шифр': p.code,
      'Статус проекта': STATUS_LABEL[p.status],
      'Волна': p.wave,
      'Номер лота': lotNumber(p.lot_label),
      'Технологическое направление': p.tech_direction,
      'Тема НИОКР (из сводной)': p.topic,
      'Тема НИОКР по ТЗ': '',
      'Наименование лота': '',
      'Формулировка темы НИОКР из договора': '',
      'Краткое наименование исполнителя': p.executor_short,
      'Исполнитель полное наименование': p.executor_full,
      'ИНН': p.executor_inn,
      'КПП': p.executor_kpp,
      'Адрес заявителя': p.executor_address,
      'ID PM': p.number,
      'Номер конкурсной заявки': p.competition_application_number,
      'Номер соглашения о предоставлении субсидии с Минобрнауки в 2024 году': c2024?.subsidy_agreement_number ?? '',
      'Дата соглашения о предоставлении субсидии с Минобрнауки в 2024 году': formatDate(c2024?.subsidy_agreement_date),
      'Номер соглашения о предоставлении субсидии с Минобрнауки в 2025 году': c2025?.subsidy_agreement_number ?? '',
      'Дата соглашения о предоставлении субсидии с Минобрнауки в 2025 году': formatDate(c2025?.subsidy_agreement_date),
      'Номер соглашения о предоставлении субсидии с Минпромторгом в 2026 году': c2026?.subsidy_agreement_number ?? '',
      'Дата соглашения о предоставлении субсидии с Минпромторгом в 2026 году': formatDate(c2026?.subsidy_agreement_date),
      'Номер решения о предоставлении субсидии в 2024 году': c2024?.subsidy_decision_number ?? '',
      'Дата решения о предоставлении субсидии в 2024 году': formatDate(c2024?.subsidy_decision_date),
      'Номер решения о предоставлении субсидии в 2025 году': c2025?.subsidy_decision_number ?? '',
      'Дата решения о предоставлении субсидии в 2025 году': formatDate(c2025?.subsidy_decision_date),
      'Номер решения о предоставлении субсидии в 2026 году': c2026?.subsidy_decision_number ?? '',
      'Дата решения о предоставлении субсидии в 2026 году': formatDate(c2026?.subsidy_decision_date),
      'Номер протокола конкурсной комиссии - объявление отбора': p.protocol_announce_number,
      'Дата протокола конкурсной комиссии - объявление отбора': formatDate(p.protocol_announce_date),
      'Номер протокола конкурсной комиссии - подведение итогов отбора': p.protocol_number,
      'Дата протокола конкурсной комиссии - подведение итогов отбора': formatDate(p.protocol_date),
      'Идентификатор субсидии в 2024 году': c2024?.subsidy_identifier ?? '',
      'Идентификатор субсидии в 2025 году': c2025?.subsidy_identifier ?? '',
      'Идентификатор субсидии в 2026 году': c2026?.subsidy_identifier ?? '',
      'КБК': p.kbk,
      'Код по КБК': p.kbk_code,
      'Наименование результата предоставления субсидии': p.result_name,
      'Код результата': p.result_code,
      'ОБЩИЙ Комментарий по датам': '',
      'Номер карточки проекта в ЕГИСУ НИОКТР': p.egisu_number,
      'Номер грантового договора 2024 года': c2024?.contract_number ?? '',
      'Дата грантового договора 2024 года': formatDate(c2024?.contract_date),
      'Номер счёта 2024 года': c2024?.invoice_number ?? '',
      'АКР 2024 года': c2024?.akr ?? '',
      'Реквизиты дополнительных соглашений к договору 2024 года': formatAdditionalAgreements(c2024?.additional_agreements),
      'Номер грантового договора 2025 года': c2025?.contract_number ?? '',
      'Дата грантового договора 2025 года': formatDate(c2025?.contract_date),
      'Номер счёта 2025 года': c2025?.invoice_number ?? '',
      'АКР 2025 года': c2025?.akr ?? '',
      'Реквизиты дополнительных соглашений к договору 2025 года': formatAdditionalAgreements(c2025?.additional_agreements),
      'Номер грантового договора 2026 года': c2026?.contract_number ?? '',
      'Дата грантового договора 2026 года': formatDate(c2026?.contract_date),
      'Номер счёта 2026 года': c2026?.invoice_number ?? '',
      'АКР 2026 года': c2026?.akr ?? '',
      'Реквизиты дополнительных соглашений к договору 2026 года': formatAdditionalAgreements(c2026?.additional_agreements),
      'Окончание этапа 1': formatDate(stage(1)?.end_date),
      'Окончание этапа 2': formatDate(stage(2)?.end_date),
      'Окончание этапа 3': formatDate(stage(3)?.end_date),
      'Требование о возврате — этап 1': formatClaims(stage(1)?.claims),
      'Требование о возврате — этап 2': formatClaims(stage(2)?.claims),
      'Требование о возврате — этап 3': formatClaims(stage(3)?.claims),
      'Сумма гранта из сводной': grantTotal || '',
      'Обязательства 2024': obligationByYear[2024] || '',
      'Оплачено 2024': paidByYear[2024] || '',
      'Обязательства 2025': obligationByYear[2025] || '',
      'Оплачено 2025': paidByYear[2025] || '',
      'Обязательства 2026': obligationByYear[2026] || '',
      'Оплачено 2026': paidByYear[2026] || '',
      'Обязательства 2027 без переносов': obligationByYear[2027] || '',
      'Прогноз переносов 2026->2027': '',
      'Обязательства 2027 с переносами': '',
      'Итого обязательства без переносов': totalObligation || '',
      'Итого обязательства с переносами': '',
      'Итого оплачено': totalPaid || '',
      'Остаток без переносов': totalObligation - totalPaid || '',
      'РИД 2024': '',
      'РИД 2025': '',
      'РИД 2026': '',
      'РИД 2027': '',
      'РИД всего': '',
      'РИД зарегистрировано': '',
      'РИД заявка/не зарегистрировано': '',
      'РИД уточнить': '',
      'Комментарий по качеству данных': p.data_quality_comment,
      'Индустриальный партнер / заказчик из заявки': '',
      'Подтверждающий документ партнера': '',
      'Ключевые соисполнители': '',
      'Прочие партнеры / заказчики / потребители': '',
      'Источник/комментарий по партнерам': '',
      'Ответственный сотрудник со стороны исполнителя': '',
      'Телефон ответственного сотрудника': '',
      'Email ответственного сотрудника': '',
      'Email организации': p.org_email,
      'Email Получателя гранта из последнего подписанного договора': p.grantee_email_from_contract,
      'Контакт по орг. вопросам': '',
      'Контакт по технике': '',
      'Комментарий пользователя': p.user_comment,
      'Комментарий по востребованности': p.demand_comment,
      'Комментарий по финэкспертизе': p.financial_expertise_comment,
      'Состояние исполнителя': p.executor_state,
      'Примечание источника': '',
    }
  })

  // ---------- Лист «Платежи» ----------
  const paymentRows = projects.flatMap((p) =>
    (p.payments ?? []).map((pay) => ({
      payment_id: pay.external_payment_id || pay.id,
      project_id: externalId(p),
      'Шифр': p.code,
      'Исполнитель': p.executor_short,
      'Технологическое направление': p.tech_direction,
      'Номер договора': pay.contract_number,
      'Тип записи': pay.record_type,
      'Период/этап': pay.period_label,
      'Дата не ранее': formatDate(pay.window_start),
      'Дата не позднее / плановая': formatDate(pay.window_end),
      'Год по плану': pay.plan_year ?? '',
      'Факт выплаты': pay.actually_paid ? 'Да' : 'Нет',
      'Дата заявки на платёж': formatDate(pay.payment_request_date),
      'Сумма обязательства, руб.': pay.obligation_amount ?? '',
      'Сумма оплаты, руб.': pay.paid_amount ?? '',
      'Переносить в сценарии': pay.carry_forward ? 'Да' : 'Нет',
      'Год с учетом переноса': pay.adjusted_year ?? '',
      'Прогнозный перенос 2026->2027': pay.forecast_carry_2026_2027 ? 'Да' : 'Нет',
      'Учитывается при статусе проекта': '',
      'Источник строки': pay.source_note,
      'Комментарий': pay.comment,
      'Номер заявки на платёж': pay.payment_request_number,
      'Комментарий по заявке на платёж': pay.payment_request_comment,
    }))
  )

  const workbook = XLSX.utils.book_new()

  const projectSheet = XLSX.utils.json_to_sheet(projectRows)
  projectSheet['!cols'] = Object.keys(projectRows[0] ?? {}).map((key) => ({ wch: Math.min(Math.max(key.length, 10), 40) }))
  XLSX.utils.book_append_sheet(workbook, projectSheet, 'Проекты')

  const paymentSheet = XLSX.utils.json_to_sheet(paymentRows)
  paymentSheet['!cols'] = Object.keys(paymentRows[0] ?? {}).map((key) => ({ wch: Math.min(Math.max(key.length, 10), 40) }))
  XLSX.utils.book_append_sheet(workbook, paymentSheet, 'Платежи')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="projects-mega-format-${new Date().toLocaleDateString('en-CA')}.xlsx"`,
    },
  })
}

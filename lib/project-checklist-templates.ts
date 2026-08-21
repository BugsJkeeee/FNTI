import type { ChecklistTrack } from '@/types'

type StageDates = { end_date: string | null }

type TemplateStep = {
  template_key: string
  title: string
  // null = дата не считается автоматически, сотрудник ставит сам
  computeTargetDate: (stage: StageDates) => string | null
}

// Локальный date-safe хелпер (без toISOString() — сдвигает дату при смене часового
// пояса, ту же проблему уже чинили в lib/date-context.ts).
function minusMonths(dateISO: string | null, months: number): string | null {
  if (!dateISO) return null
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(y, m - 1 - months, d)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export const TECHNICAL_TEMPLATE: TemplateStep[] = [
  { template_key: 'tech_1', title: 'Открыть точку загрузки 1-го комплекта отчётной документации', computeTargetDate: (s) => minusMonths(s.end_date, 1) },
  { template_key: 'tech_2', title: 'Комплект получен → отправлен в МФТИ', computeTargetDate: () => null },
  { template_key: 'tech_3', title: 'Первичная проверка отчетности МФТИ', computeTargetDate: () => null },
  { template_key: 'tech_4', title: 'Открыта контрольная точка по загрузке финального комплекта документации (при необходимости)', computeTargetDate: () => null },
  { template_key: 'tech_5', title: 'Повторная экспертиза отчетности МФТИ', computeTargetDate: () => null },
  { template_key: 'tech_6', title: 'Получено и проверено заключение эксперта', computeTargetDate: () => null },
  { template_key: 'tech_7', title: 'Результаты утверждены на Грантовой комиссии', computeTargetDate: () => null },
]

export const FINANCIAL_TEMPLATE: TemplateStep[] = [
  { template_key: 'fin_1', title: 'Открыть точку для загрузки финансовой отчетности', computeTargetDate: (s) => s.end_date },
  { template_key: 'fin_2', title: 'Документы получены → проверены', computeTargetDate: () => null },
  { template_key: 'fin_3', title: 'Первичная проверка отчетности', computeTargetDate: () => null },
  { template_key: 'fin_4', title: 'Направлены замечания от эксперта — получены пояснения', computeTargetDate: () => null },
  { template_key: 'fin_5', title: 'Повторная экспертиза доработанной отчетности', computeTargetDate: () => null },
  { template_key: 'fin_6', title: 'Заключение получено (на внутренней проверке)', computeTargetDate: () => null },
  { template_key: 'fin_7', title: 'Результаты утверждены Грантовой комиссией', computeTargetDate: () => null },
  { template_key: 'fin_8', title: 'Направлено требование о возврате (при необходимости)', computeTargetDate: () => null },
  { template_key: 'fin_9', title: 'Исполнено требование о возврате', computeTargetDate: () => null },
]

export const FINAL_TECHNICAL_KEY = 'tech_7'
export const FINAL_FINANCIAL_KEY = 'fin_9'

/** Этап закрыт, когда финальный шаг обоих треков отмечен выполненным. */
export function isStageClosed(items: { template_key: string | null; done: boolean }[]): boolean {
  const tech = items.find((i) => i.template_key === FINAL_TECHNICAL_KEY)
  const fin = items.find((i) => i.template_key === FINAL_FINANCIAL_KEY)
  return !!tech?.done && !!fin?.done
}

/** Строки для вставки в project_checklist_items под конкретный этап (обе дорожки). */
export function buildChecklistRows(stage: StageDates) {
  const rows: {
    track: ChecklistTrack
    step_order: number
    template_key: string
    is_default: true
    title: string
    target_date: string | null
  }[] = []

  TECHNICAL_TEMPLATE.forEach((step, i) => {
    rows.push({
      track: 'technical',
      step_order: i + 1,
      template_key: step.template_key,
      is_default: true,
      title: step.title,
      target_date: step.computeTargetDate(stage),
    })
  })

  FINANCIAL_TEMPLATE.forEach((step, i) => {
    rows.push({
      track: 'financial',
      step_order: i + 1,
      template_key: step.template_key,
      is_default: true,
      title: step.title,
      target_date: step.computeTargetDate(stage),
    })
  })

  return rows
}

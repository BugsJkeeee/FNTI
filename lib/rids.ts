import type { ProjectRid } from '@/types'

// Виды РИД в порядке показа. «Заявка на …» — тот же вид, но охранный документ ещё не получен.
export const RID_KINDS = [
  'Программа для ЭВМ',
  'База данных',
  'Секрет производства (ноу-хау)',
  'Изобретение',
  'Полезная модель',
  'Топология ИМС',
  'Промышленный образец',
  'Заявка на программу для ЭВМ',
  'Заявка на изобретение',
  'Заявка на полезную модель',
  'Заявка на промышленный образец',
] as const

const APPLICATION_PREFIX = 'Заявка на '

export function isApplication(kind: string): boolean {
  return kind.startsWith(APPLICATION_PREFIX)
}

// Вид без признака «заявка»: для аналитики по типам заявка и оформленный РИД считаются одним типом.
export function baseKind(kind: string): string {
  if (!isApplication(kind)) return kind
  const rest = kind.slice(APPLICATION_PREFIX.length)
  if (rest === 'программу для ЭВМ') return 'Программа для ЭВМ'
  if (rest === 'полезную модель') return 'Полезная модель'
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

export function ridYear(rid: Pick<ProjectRid, 'application_date'>): number | null {
  return rid.application_date ? Number(rid.application_date.slice(0, 4)) : null
}

export type RidStage = 'created' | 'protected' | 'used'

// Этапы реестра ЕГИСУ: создание → правовая охрана → использование.
export function ridStages(rid: ProjectRid): Record<RidStage, boolean> {
  return {
    created: !!rid.egisu_created_number,
    protected: !!rid.egisu_protection_number,
    used: !!rid.egisu_usage_number,
  }
}

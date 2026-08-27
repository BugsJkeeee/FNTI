import type { Project } from '@/types'

export const STATUS_LABELS: Record<Project['status'], string> = {
  active: 'действующий',
  terminating: 'прекращаем',
  terminated: 'прекращён',
}
export const STATUS_ORDER: Project['status'][] = ['active', 'terminating', 'terminated']

export function formatRub(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + ' ₽'
}

// Для KPI/сводных цифр копейки не нужны — округляем, чтобы число не переносилось на
// вторую строку в узкой плашке. Точные суммы с копейками — в детальных строках/drill-down.
export function formatRubRounded(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'
}

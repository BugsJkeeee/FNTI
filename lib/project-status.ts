import type { ChecklistTrack, Project, ProjectStage } from '@/types'
import { isStageClosed } from '@/lib/project-checklist-templates'

const TRACK_NOUN: Record<ChecklistTrack, string> = {
  technical: 'технической отчётности',
  financial: 'финансовой отчётности',
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('ru-RU') : '—'
}

export function currentStageOf(project: Project): ProjectStage | null {
  const stages = [...(project.stages ?? [])].sort((a, b) => a.stage_number - b.stage_number)
  if (stages.length === 0) return null
  return stages.find((s) => !isStageClosed(s.checklist_items ?? [])) ?? stages[stages.length - 1]
}

/** Текстовый статус трека (тех./фин. приёмка) текущего этапа — используется в списке проектов и в экспорте. */
export function trackStatus(stage: ProjectStage | null, track: ChecklistTrack) {
  if (!stage) return { text: '—', overdue: false, planned: false }
  const items = (stage.checklist_items ?? [])
    .filter((i) => i.track === track)
    .sort((a, b) => a.step_order - b.step_order)
  const next = items.find((i) => !i.done)
  if (!next) {
    if (items.length === 0) return { text: '—', overdue: false, planned: false }
    // Все шаги выполнены — вместо общей фразы показываем сам последний шаг: его название,
    // дату (если проставлена) и комментарий (если есть) — так в списке сразу видно, чем
    // закрылась приёмка, а не просто факт "выполнено".
    const last = items[items.length - 1]
    const text = `${last.title}${last.target_date ? ` · ${formatDate(last.target_date)}` : ''}${last.comment ? ` — ${last.comment}` : ''}`
    return { text, overdue: false, planned: false }
  }
  const today = new Date().toLocaleDateString('en-CA')
  if (next.target_date && next.target_date > today) {
    return { text: `Подача ${TRACK_NOUN[track]} запланирована на ${formatDate(next.target_date)}`, overdue: false, planned: true }
  }
  const overdue = !!next.target_date && next.target_date < today
  const text = next.target_date ? `${next.title} · ${formatDate(next.target_date)}` : next.title
  return { text, overdue, planned: false }
}

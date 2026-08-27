import type { ProjectChecklistItem, ProjectClaim } from '@/types'
import { isStageClosed } from '@/lib/project-checklist-templates'
import type { ProjectForFinance } from '@/lib/project-finance'

// Расширение ProjectForFinance полями, которых там нет, но нужны таблице проектов и
// риск-движку — тот же исходный тип, не параллельная модель (см. план в
// C:\Users\HP\.claude\plans\rippling-twirling-finch.md).
export type ProjectForAnalytics = Omit<ProjectForFinance, 'stages'> & {
  topic: string
  stages: (ProjectForFinance['stages'][number] & {
    stage_number: number
    name: string
    start_date: string | null
    end_date: string | null
    checklist_items: ProjectChecklistItem[]
  })[]
}

export type RiskLevel = 'none' | 'medium' | 'high'

export type StageRisk = {
  stageId: string
  stageNumber: number
  level: RiskLevel
  amount: number
  reasons: string[]
  // Отрицательное — просрочено на столько дней; положительное — столько дней до срока;
  // null — нет ни одного незакрытого шага с проставленной датой (нечего мерить).
  daysToDeadline: number | null
}

export type ProjectRisk = {
  projectId: string
  level: RiskLevel
  amount: number
  stageRisks: StageRisk[]
  nextStageLabel: string | null
}

export type PortfolioRisk = {
  totalAtRiskAmount: number
  atRiskProjectsCount: number
  atRiskStagesCount: number
  overdueStagesCount: number
  byProject: Map<string, ProjectRisk>
}

const LEVEL_RANK: Record<RiskLevel, number> = { none: 0, medium: 1, high: 2 }

function trackProgress(items: ProjectChecklistItem[], track: 'technical' | 'financial'): number {
  const trackItems = items.filter((i) => i.track === track)
  if (trackItems.length === 0) return 0
  return trackItems.filter((i) => i.done).length / trackItems.length
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86400000)
}

type StageForRisk = {
  id: string
  stage_number: number
  cost: number | null
  checklist_items?: ProjectChecklistItem[]
  claims?: ProjectClaim[]
}

/**
 * Риск этапа — адаптация правил инструкции (просрочка / низкое продвижение приёмки при
 * близком сроке) под реальную схему: у нас нет "бюджет/факт этапа", есть чек-лист
 * приёмки (tech+fin треки) с done/target_date — прогресс и просрочка считаются по нему
 * через уже существующий trackStatus(). Плюс отдельное правило, которого нет в
 * инструкции: неисполненное требование о возврате (project_claims) — это не эвристика,
 * а факт из протокола комиссии, всегда 'high'.
 */
export function calculateStageRisk(stage: StageForRisk): StageRisk {
  const items = stage.checklist_items ?? []
  const claims = stage.claims ?? []
  const budget = Number(stage.cost) || 0
  const today = new Date().toLocaleDateString('en-CA')

  let level: RiskLevel = 'none'
  let amount = 0
  const reasons: string[] = []
  let daysToDeadline: number | null = null

  if (!isStageClosed(items)) {
    for (const track of ['technical', 'financial'] as const) {
      const progress = trackProgress(items, track)
      const trackItems = items.filter((i) => i.track === track)
      // "Следующий" шаг — первый невыполненный ПОСЛЕ самого позднего уже выполненного, а не
      // просто первый невыполненный по порядку. У части проектов помечен вручную только
      // финальный/значимый шаг (например fin_6), а более ранние (fin_1-5) остались
      // непроставлены, хотя реально уже пройдены — наивная логика "первый невыполненный"
      // ошибочно считала бы это многомесячной просрочкой с самого начала этапа.
      const maxDoneOrder = Math.max(0, ...trackItems.filter((i) => i.done).map((i) => i.step_order))
      const nextItem = trackItems.filter((i) => !i.done && i.step_order > maxDoneOrder).sort((a, b) => a.step_order - b.step_order)[0]
      const targetDate = nextItem?.target_date ?? null
      const trackLabel = track === 'technical' ? 'техническая приёмка' : 'финансовая приёмка'
      const overdue = !!targetDate && targetDate < today

      if (overdue && targetDate) {
        const overdueDays = daysBetween(targetDate, today)
        daysToDeadline = daysToDeadline === null ? -overdueDays : Math.min(daysToDeadline, -overdueDays)
        if (overdueDays > 14) {
          if (LEVEL_RANK.high > LEVEL_RANK[level]) level = 'high'
          amount = Math.max(amount, budget)
          reasons.push(`Просрочка ${overdueDays} дней (${trackLabel})`)
        } else if (overdueDays > 0) {
          if (LEVEL_RANK.medium > LEVEL_RANK[level]) level = 'medium'
          amount = Math.max(amount, budget * 0.7)
          reasons.push(`Просрочка ${overdueDays} дней (${trackLabel})`)
        }
      } else if (targetDate) {
        const daysLeft = daysBetween(today, targetDate)
        daysToDeadline = daysToDeadline === null ? daysLeft : Math.min(daysToDeadline, daysLeft)
        if (daysLeft >= 0 && daysLeft < 30 && progress < 0.4) {
          if (LEVEL_RANK.high > LEVEL_RANK[level]) level = 'high'
          amount = Math.max(amount, budget)
          reasons.push(`Низкое продвижение приёмки (${Math.round(progress * 100)}%) при сроке < 30 дней (${trackLabel})`)
        } else if (daysLeft >= 0 && daysLeft < 60 && progress < 0.6) {
          if (LEVEL_RANK.medium > LEVEL_RANK[level]) level = 'medium'
          amount = Math.max(amount, budget * 0.5)
          reasons.push(`Низкое продвижение приёмки (${Math.round(progress * 100)}%) при сроке < 60 дней (${trackLabel})`)
        }
      }
    }
  }

  // fin_9/fin_10 (требование о возврате) не входят в isStageClosed — проверяем claims
  // независимо от того, закрыт ли этап.
  const outstandingClaims = claims.filter((c) => c.claim_execution_payments.length === 0)
  if (outstandingClaims.length > 0) {
    level = 'high'
    amount += outstandingClaims.reduce((s, c) => s + (c.claim_balance ?? 0), 0)
    reasons.push('Открытое требование о возврате не исполнено')
  }

  return { stageId: stage.id, stageNumber: stage.stage_number, level, amount, reasons, daysToDeadline }
}

export function calculatePortfolioRisk(projects: ProjectForAnalytics[]): PortfolioRisk {
  const byProject = new Map<string, ProjectRisk>()
  let totalAtRiskAmount = 0
  let atRiskStagesCount = 0
  let overdueStagesCount = 0

  for (const project of projects) {
    const stages = [...project.stages].sort((a, b) => a.stage_number - b.stage_number)
    const stageRisks = stages.map((s) => calculateStageRisk(s))

    let projectLevel: RiskLevel = 'none'
    let projectAmount = 0
    stageRisks.forEach((r) => {
      if (LEVEL_RANK[r.level] > LEVEL_RANK[projectLevel]) projectLevel = r.level
      if (r.level !== 'none') {
        projectAmount += r.amount
        atRiskStagesCount++
      }
      if (r.daysToDeadline !== null && r.daysToDeadline < 0) overdueStagesCount++
    })

    const nextStage = stages.find((s) => !isStageClosed(s.checklist_items))
    byProject.set(project.id, {
      projectId: project.id,
      level: projectLevel,
      amount: projectAmount,
      stageRisks,
      nextStageLabel: nextStage ? `Этап ${nextStage.stage_number}${nextStage.name ? ` · ${nextStage.name}` : ''}` : null,
    })
    if (projectLevel !== 'none') totalAtRiskAmount += projectAmount
  }

  const atRiskProjectsCount = [...byProject.values()].filter((p) => p.level !== 'none').length

  return { totalAtRiskAmount, atRiskProjectsCount, atRiskStagesCount, overdueStagesCount, byProject }
}

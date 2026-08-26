import type { DirectionSubsidyPlan, Project, ProjectClaim, ProjectPayment, ProjectStage } from '@/types'

export type ProjectForFinance = Pick<Project, 'id' | 'number' | 'wave' | 'code' | 'status' | 'tech_direction'> & {
  stages: (Pick<ProjectStage, 'id' | 'cost'> & { claims: ProjectClaim[] })[]
}

export type PaymentWithProject = ProjectPayment & {
  project: Pick<Project, 'id' | 'number' | 'code' | 'wave' | 'tech_direction' | 'status'>
}

export type ProjectShare = { projectId: string; code: string; number: number; obligation: number; released: number }

export type DirectionYearFinance = {
  year: number
  plan: number
  released: number
  remainder: number
  pct: number
  byProject: ProjectShare[]
}

export type DirectionFinance = {
  direction: string
  years: DirectionYearFinance[]
  totalPlan: number
  totalReleased: number
  totalRemainder: number
}

export type YearTotal = { year: number; plan: number; released: number; remainder: number; pct: number }

export type ClaimRow = {
  projectId: string
  code: string
  number: number
  claimNumber: string
  balance: number | null
  misuse: number | null
  noncompliance: number | null
  resolved: boolean
}

export type ClaimsSummary = {
  totalClaims: number
  sumBalance: number
  sumOutstandingBalance: number
  sumMisuse: number
  sumNoncompliance: number
  resolvedCount: number
  outstandingCount: number
  claims: ClaimRow[]
}

export type PortfolioKpis = { totalProjects: number; byWave: Record<number, number>; totalBudget: number }

export type FinanceSummary = {
  kpis: PortfolioKpis
  byDirection: DirectionFinance[]
  yearTotals: YearTotal[]
  allYears: number[]
  claims: ClaimsSummary
}

export function aggregatePortfolioFinance(
  projects: ProjectForFinance[],
  payments: PaymentWithProject[],
  directionPlans: DirectionSubsidyPlan[],
  opts: { includedProjectIds: Set<string> }
): FinanceSummary {
  const { includedProjectIds } = opts

  const visibleProjects = projects.filter((p) => includedProjectIds.has(p.id))
  const visiblePayments = payments.filter((p) => includedProjectIds.has(p.project.id))

  const byWave: Record<number, number> = {}
  let totalBudget = 0
  visibleProjects.forEach((p) => {
    byWave[p.wave] = (byWave[p.wave] ?? 0) + 1
    totalBudget += p.stages.reduce((sum, s) => sum + (Number(s.cost) || 0), 0)
  })
  const kpis: PortfolioKpis = { totalProjects: visibleProjects.length, byWave, totalBudget }

  // Направления берём из плана (независим от отбора проектов) и из отобранных проектов —
  // так строка направления не исчезает, если под фильтр не попал ни один его проект,
  // и видно "план есть, факта в этом отборе — 0".
  const directionNames = new Set<string>()
  visibleProjects.forEach((p) => p.tech_direction && directionNames.add(p.tech_direction))
  directionPlans.forEach((d) => directionNames.add(d.tech_direction))

  const byDirection: DirectionFinance[] = [...directionNames]
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((direction) => {
      const directionPlanRows = directionPlans.filter((d) => d.tech_direction === direction)
      const directionPayments = visiblePayments.filter((p) => p.project.tech_direction === direction)

      const years = new Set<number>()
      directionPlanRows.forEach((d) => years.add(d.year))
      directionPayments.forEach((p) => p.plan_year && years.add(p.plan_year))

      const yearRows: DirectionYearFinance[] = [...years]
        .sort((a, b) => a - b)
        .map((year) => {
          const plan = directionPlanRows.find((d) => d.year === year)?.amount ?? 0
          const yearPayments = directionPayments.filter((p) => p.plan_year === year)
          const released = yearPayments.reduce((sum, p) => sum + (p.actually_paid ? Number(p.paid_amount) || 0 : 0), 0)
          // Остаток имеет смысл только там, где план задан — иначе это не "недоведённые деньги",
          // а просто отсутствие плана для сверки (см. "план не задан" в UI).
          const remainder = plan > 0 ? Math.max(0, plan - released) : 0
          const pct = plan > 0 ? (released / plan) * 100 : 0

          const byProjectMap = new Map<string, ProjectShare>()
          yearPayments.forEach((p) => {
            const cur = byProjectMap.get(p.project.id) ?? {
              projectId: p.project.id,
              code: p.project.code,
              number: p.project.number,
              obligation: 0,
              released: 0,
            }
            cur.obligation += Number(p.obligation_amount) || 0
            cur.released += p.actually_paid ? Number(p.paid_amount) || 0 : 0
            byProjectMap.set(p.project.id, cur)
          })

          return { year, plan, released, remainder, pct, byProject: [...byProjectMap.values()] }
        })

      const totalPlan = yearRows.reduce((s, y) => s + y.plan, 0)
      const totalReleased = yearRows.reduce((s, y) => s + y.released, 0)
      const totalRemainder = yearRows.reduce((s, y) => s + y.remainder, 0)
      return { direction, years: yearRows, totalPlan, totalReleased, totalRemainder }
    })

  const allYearsSet = new Set<number>()
  directionPlans.forEach((d) => allYearsSet.add(d.year))
  visiblePayments.forEach((p) => p.plan_year && allYearsSet.add(p.plan_year))
  const allYears = [...allYearsSet].sort((a, b) => a - b)

  const yearTotals: YearTotal[] = allYears.map((year) => {
    const plan = directionPlans.filter((d) => d.year === year).reduce((s, d) => s + d.amount, 0)
    const released = visiblePayments
      .filter((p) => p.plan_year === year && p.actually_paid)
      .reduce((s, p) => s + (Number(p.paid_amount) || 0), 0)
    const remainder = plan > 0 ? Math.max(0, plan - released) : 0
    const pct = plan > 0 ? (released / plan) * 100 : 0
    return { year, plan, released, remainder, pct }
  })

  const claimRows: ClaimRow[] = visibleProjects.flatMap((p) =>
    p.stages.flatMap((s) =>
      s.claims.map((c) => ({
        projectId: p.id,
        code: p.code,
        number: p.number,
        claimNumber: c.claim_number,
        balance: c.claim_balance,
        misuse: c.claim_misuse_amount,
        noncompliance: c.claim_noncompliance_amount,
        resolved: c.claim_execution_payments.length > 0,
      }))
    )
  )
  const claims: ClaimsSummary = {
    totalClaims: claimRows.length,
    sumBalance: claimRows.reduce((s, c) => s + (c.balance ?? 0), 0),
    sumOutstandingBalance: claimRows.filter((c) => !c.resolved).reduce((s, c) => s + (c.balance ?? 0), 0),
    sumMisuse: claimRows.reduce((s, c) => s + (c.misuse ?? 0), 0),
    sumNoncompliance: claimRows.reduce((s, c) => s + (c.noncompliance ?? 0), 0),
    resolvedCount: claimRows.filter((c) => c.resolved).length,
    outstandingCount: claimRows.filter((c) => !c.resolved).length,
    claims: claimRows,
  }

  return { kpis, byDirection, yearTotals, allYears, claims }
}

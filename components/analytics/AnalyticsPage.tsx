'use client'

import { useMemo, useRef } from 'react'
import { aggregatePortfolioFinance, type PaymentWithProject } from '@/lib/project-finance'
import { calculatePortfolioRisk, type ProjectForAnalytics } from '@/lib/project-risk'
import type { DirectionSubsidyPlan } from '@/types'
import KpiCards from './KpiCards'
import FiltersBar, { useAnalyticsFilters } from './FiltersBar'
import YearProgress from './YearProgress'
import DirectionRemainders from './DirectionRemainders'
import RiskPanel from './RiskPanel'
import DirectionYearTable from './DirectionYearTable'
import ClaimsSummary from './ClaimsSummary'

export default function AnalyticsPage({
  projects,
  payments,
  directionPlans,
}: {
  projects: ProjectForAnalytics[]
  payments: PaymentWithProject[]
  directionPlans: DirectionSubsidyPlan[]
}) {
  const riskPanelRef = useRef<HTMLDivElement>(null)
  const filters = useAnalyticsFilters(projects)

  // Риск считается по ВСЕМУ портфелю один раз — это свойство проекта/этапа, не зависит
  // от текущего отбора фильтром (фильтр применяется поверх, ниже).
  const portfolioRisk = useMemo(() => calculatePortfolioRisk(projects), [projects])

  const includedProjectIds = useMemo(() => {
    if (!filters.onlyRisk) return filters.includedProjectIds
    return new Set([...filters.includedProjectIds].filter((id) => (portfolioRisk.byProject.get(id)?.level ?? 'none') !== 'none'))
  }, [filters.includedProjectIds, filters.onlyRisk, portfolioRisk])

  const summary = useMemo(
    () => aggregatePortfolioFinance(projects, payments, directionPlans, { includedProjectIds }),
    [projects, payments, directionPlans, includedProjectIds]
  )

  const filteredProjects = useMemo(() => projects.filter((p) => includedProjectIds.has(p.id)), [projects, includedProjectIds])

  function handleRiskClick() {
    filters.setOnlyRisk(true)
    riskPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mt-4 space-y-4">
      <KpiCards
        totalProjects={summary.kpis.totalProjects}
        byWave={summary.kpis.byWave}
        totalBudget={summary.kpis.totalBudget}
        risk={portfolioRisk}
        onRiskClick={handleRiskClick}
      />
      <FiltersBar projects={projects} filters={filters} />
      <YearProgress yearTotals={summary.yearTotals} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DirectionRemainders byDirection={summary.byDirection} onSelectDirection={filters.direction.setOnly} />
        </div>
        <div className="lg:col-span-2">
          <RiskPanel ref={riskPanelRef} projects={filteredProjects} risk={portfolioRisk} />
        </div>
      </div>
      <DirectionYearTable byDirection={summary.byDirection} allYears={summary.allYears} />
      <ClaimsSummary claims={summary.claims} />
    </div>
  )
}

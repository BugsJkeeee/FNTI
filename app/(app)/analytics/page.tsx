import { createClient } from '@/lib/supabase/server'
import AnalyticsPageClient from '@/components/analytics/AnalyticsPage'
import type { DirectionSubsidyPlan } from '@/types'
import type { PaymentWithProject } from '@/lib/project-finance'
import type { ProjectForAnalytics } from '@/lib/project-risk'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select(
      'id, number, wave, code, status, tech_direction, topic, stages:project_stages(id, stage_number, name, start_date, end_date, cost, claims:project_claims(*), checklist_items:project_checklist_items(*))'
    )

  const { data: payments } = await supabase
    .from('project_payments')
    .select('*, project:projects(id, number, code, wave, tech_direction, status)')

  const { data: directionPlans } = await supabase
    .from('direction_subsidy_plans')
    .select('*')
    .order('tech_direction')
    .order('year')

  return (
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Аналитика портфеля</h1>
      <p className="mt-1 text-sm text-ink-soft">Бюджет по направлениям, освоение и требования о возврате.</p>
      <AnalyticsPageClient
        projects={(projects as ProjectForAnalytics[]) ?? []}
        payments={(payments as PaymentWithProject[]) ?? []}
        directionPlans={(directionPlans as DirectionSubsidyPlan[]) ?? []}
      />
    </div>
  )
}

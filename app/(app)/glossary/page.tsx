import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import GlossaryForm from '@/components/GlossaryForm'
import GlossaryList from '@/components/GlossaryList'
import TagsSection from '@/components/TagsSection'
import DirectionSubsidyPlans from '@/components/DirectionSubsidyPlans'
import type { DirectionSubsidyPlan, GlossaryEntry, Tag } from '@/types'

export default async function GlossaryPage() {
  const employee = await getCurrentEmployee()
  const supabase = await createClient()

  const { data } = await supabase
    .from('glossary_entries')
    .select('*, author:employees(id, name)')
    .order('created_at', { ascending: false })

  const entries = (data as GlossaryEntry[]) ?? []

  const { data: tagsData } = await supabase.from('tags').select('*').order('created_at', { ascending: false })
  const tags = (tagsData as Tag[]) ?? []

  const { data: subsidyPlansData } = await supabase
    .from('direction_subsidy_plans')
    .select('*')
    .order('tech_direction')
    .order('year')
  const subsidyPlans = (subsidyPlansData as DirectionSubsidyPlan[]) ?? []

  const { data: directionsData } = await supabase.from('projects').select('tech_direction')
  const directions = [...new Set((directionsData ?? []).map((p) => p.tech_direction).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru')
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Глоссарий проекта</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Термины, клиенты, сокращения команды — этот текст целиком передаётся ИИ при распределении каждой новой задачи.
        </p>
      </div>

      <TagsSection initialTags={tags} />

      <DirectionSubsidyPlans plans={subsidyPlans} directions={directions} />

      <GlossaryForm authorId={employee!.id} />

      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-base font-semibold text-ink">Все записи</h2>
        <div className="mt-3">
          <GlossaryList entries={entries} currentEmployeeId={employee!.id} isOwner={employee!.is_owner} />
        </div>
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import FeoView from '@/components/FeoView'
import type { FeoDocument, FeoExpense, FeoPlanItem, FeoPurchase, FeoSheet } from '@/types'

export default async function ProjectFeoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, number, code, executor_short').eq('id', id).single()
  if (!project) notFound()

  const { data: doc } = await supabase.from('feo_documents').select('*').eq('project_id', id).maybeSingle()

  if (!doc) {
    return (
      <div className="space-y-4">
        <Link href={`/projects/${id}`} className="text-sm text-ink-soft hover:text-ink">← К проекту</Link>
        <div className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-soft">ФЭО по проекту ещё не загружено.</div>
      </div>
    )
  }

  const [{ data: sheets }, { data: plan }, { data: expenses }, { data: purchases }] = await Promise.all([
    supabase.from('feo_sheets').select('*').eq('document_id', doc.id).order('sort'),
    supabase.from('feo_plan_items').select('*').eq('document_id', doc.id).order('sort'),
    supabase.from('feo_expenses').select('*').eq('document_id', doc.id).order('sort'),
    supabase.from('feo_purchases').select('*').eq('document_id', doc.id).order('sort'),
  ])

  return (
    <div className="space-y-4">
      <Link href={`/projects/${id}`} className="text-sm text-ink-soft hover:text-ink">← К проекту</Link>
      <FeoView
        project={project}
        doc={doc as FeoDocument}
        sheets={(sheets as FeoSheet[]) ?? []}
        plan={(plan as FeoPlanItem[]) ?? []}
        expenses={(expenses as FeoExpense[]) ?? []}
        purchases={(purchases as FeoPurchase[]) ?? []}
      />
    </div>
  )
}

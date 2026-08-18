import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { canSetPrivateTag, isPrivateTagName } from '@/lib/tags'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; tagId: string }> }) {
  const { id, tagId } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const supabase = await createClient()

  const { data: tag } = await supabase.from('tags').select('name').eq('id', tagId).maybeSingle()

  if (tag && isPrivateTagName(tag.name)) {
    const { data: task } = await supabase.from('tasks').select('author_id, assignee_id').eq('id', id).single()
    const isOwner = task && canSetPrivateTag(task.author_id, task.assignee_id, employee.id)
    if (!isOwner) {
      return NextResponse.json(
        { error: `Тег «${tag.name}» может убрать только тот, кто одновременно и автор, и исполнитель этой задачи.` },
        { status: 403 }
      )
    }
  }

  const { error } = await supabase.from('task_tags').delete().eq('task_id', id).eq('tag_id', tagId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

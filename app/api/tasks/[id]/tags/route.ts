import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentEmployee } from '@/lib/current-employee'
import { canSetPrivateTag, isPrivateTagName } from '@/lib/tags'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { tag_id: tagId } = await req.json()
  if (!tagId || typeof tagId !== 'string') {
    return NextResponse.json({ error: 'Нужно выбрать тег' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: tag } = await supabase.from('tags').select('*').eq('id', tagId).single()
  if (!tag) {
    return NextResponse.json({ error: 'Тег не найден. Создать новый можно на странице «Глоссарий».' }, { status: 404 })
  }

  if (isPrivateTagName(tag.name)) {
    const { data: task } = await supabase.from('tasks').select('author_id, assignee_id').eq('id', id).single()
    const isOwner = task && canSetPrivateTag(task.author_id, task.assignee_id, employee.id)
    if (!isOwner) {
      return NextResponse.json(
        { error: `Тег «${tag.name}» можно ставить только на задачу, где ты одновременно и автор, и исполнитель.` },
        { status: 403 }
      )
    }
  }

  const { error } = await supabase
    .from('task_tags')
    .upsert({ task_id: id, tag_id: tag.id }, { onConflict: 'task_id,tag_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(tag)
}

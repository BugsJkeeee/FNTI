import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentEmployee = await getCurrentEmployee()
  if (!currentEmployee || !currentEmployee.is_owner) {
    return NextResponse.json({ error: 'Только владелец продукта может удалять участников' }, { status: 403 })
  }

  if (id === currentEmployee.id) {
    return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Удаляет запись в auth.users → каскадом удаляется строка в employees
  // (employees.id -> auth.users.id on delete cascade). Задачи/комментарии/история
  // участника не удаляются — author_id/assignee_id/changed_by становятся null
  // (см. supabase-schema-final.sql), чтобы не терять данные команды.
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

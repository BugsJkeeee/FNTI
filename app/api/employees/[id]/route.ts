import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentEmployee = await getCurrentEmployee()
  if (!currentEmployee || !currentEmployee.is_owner) {
    return NextResponse.json({ error: 'Только владелец продукта может редактировать участников' }, { status: 403 })
  }

  const { name, email, password, specialization } = await req.json()
  if (password && password.length < 6) {
    return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Email/пароль живут в auth.users — меняются только через Admin API, RLS/обычный
  // клиент тут ни при чём. Пустой пароль означает "не менять".
  if (email || password) {
    const authUpdates: { email?: string; password?: string } = {}
    if (email) authUpdates.email = email
    if (password) authUpdates.password = password

    const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdates)
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const profileUpdates: Record<string, unknown> = {}
  if (name) profileUpdates.name = name
  if (email) profileUpdates.email = email
  if (specialization !== undefined) profileUpdates.specialization = specialization || null

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await admin.from('employees').update(profileUpdates).eq('id', id)
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

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

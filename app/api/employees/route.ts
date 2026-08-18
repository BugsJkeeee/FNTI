import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/current-employee'

export async function POST(req: NextRequest) {
  const currentEmployee = await getCurrentEmployee()
  if (!currentEmployee || !currentEmployee.is_owner) {
    return NextResponse.json({ error: 'Только владелец продукта может добавлять участников' }, { status: 403 })
  }

  const { name, email, password, specialization } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Заполни имя, email и пароль' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'Не удалось создать пользователя' }, { status: 500 })
  }

  const { error: profileError } = await admin.from('employees').insert({
    id: created.user.id,
    name,
    email,
    specialization: specialization || null,
    is_owner: false,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

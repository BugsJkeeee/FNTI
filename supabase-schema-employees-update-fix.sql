-- ============================================
-- ФИКС: у таблицы employees не было ни одной RLS-политики на UPDATE вообще.
-- Из-за этого форма "Личный кабинет → Специализация" (ProfileForm.tsx) молча
-- не сохраняла изменения — Postgres по умолчанию запрещает операцию, если для
-- неё нет ни одной подходящей policy.
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- ============================================

-- Участник может редактировать свою же строку. WITH CHECK (true) — не ограничиваем
-- набор полей на уровне RLS (это умеет только триггер ниже, не голый RLS).
drop policy if exists "employees_update_self" on employees;
create policy "employees_update_self" on employees
  for update
  using (auth.uid() = id)
  with check (true);

-- Защита: обычный участник не может через этот путь выдать себе is_owner или
-- подменить email (email меняется только через Admin API, см.
-- app/api/employees/[id]/route.ts). Для service_role (админ-роуты сервера,
-- уже проверившие права на уровне приложения) триггер прозрачен.
create or replace function protect_employee_fields()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if not exists (select 1 from employees where id = auth.uid() and is_owner = true) then
    new.is_owner = old.is_owner;
    new.email = old.email;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists employees_protect_fields on employees;
create trigger employees_protect_fields
  before update on employees
  for each row execute function protect_employee_fields();

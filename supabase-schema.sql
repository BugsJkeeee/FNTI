-- ============================================
-- СХЕМА БД v2: Менеджер задач с ИИ-распределением
-- Модель без ролей: любой участник может быть автором или исполнителем.
-- Единственное исключение — is_owner: только владелец добавляет участников.
--
-- Если раньше уже выполнял старую версию схемы — сначала удали старые
-- объекты (раскомментируй и выполни один раз, потом закомментируй обратно):
--
-- drop table if exists task_history cascade;
-- drop table if exists task_comments cascade;
-- drop table if exists tasks cascade;
-- drop table if exists employees cascade;
-- drop function if exists get_team_calendar();
-- drop function if exists set_updated_at();
--
-- Выполнить весь остальной файл целиком в Supabase → SQL Editor → Run
-- ============================================

-- Участники (расширяет встроенную auth.users)
create table employees (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  specialization text,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

-- Задачи
create table tasks (
  id uuid primary key default gen_random_uuid(),
  text text not null,              -- финальный текст (возможно, отредактирован ИИ)
  original_text text,              -- как ввёл автор изначально, для истории
  author_id uuid references employees(id) on delete set null,
  assignee_id uuid references employees(id) on delete set null,
  deadline date,
  priority text not null default 'обычный' check (priority in ('срочно', 'обычный', 'низкий')),
  status text not null default 'новая' check (status in ('новая', 'в работе', 'выполнена', 'просрочена')),
  ai_explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Комментарии к задачам
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references employees(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

-- История изменений
create table task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  changed_by uuid references employees(id) on delete set null,
  change_description text not null,
  changed_at timestamptz not null default now()
);

-- ============================================
-- RLS — доска общая для всех, но правки/удаление только у причастных
-- ============================================
alter table employees enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_history enable row level security;

-- Участников видят все авторизованные (нужно для выбора исполнителя)
create policy "employees_select_all" on employees
  for select using (auth.role() = 'authenticated');

-- Добавлять участников может только владелец
create policy "employees_owner_insert" on employees
  for insert with check (
    exists (select 1 from employees e where e.id = auth.uid() and e.is_owner = true)
  );

-- Участник может редактировать свою же строку (специализация, имя — см. ProfileForm).
-- WITH CHECK (true) намеренно: точечная защита полей is_owner/email — триггером ниже,
-- а не здесь, т.к. RLS не умеет сравнивать новое значение со старым по отдельным колонкам.
create policy "employees_update_self" on employees
  for update
  using (auth.uid() = id)
  with check (true);

-- Не даёт обычному участнику через этот путь выдать себе is_owner или подменить email
-- (email меняется только через Admin API — см. app/api/employees/[id]/route.ts).
-- Server-side admin-клиент (service_role, используется в route handler'ах) уже прошёл
-- проверку is_owner на уровне приложения — для него триггер не действует.
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

-- Задачи видят все авторизованные — доска общая
create policy "tasks_select_all" on tasks
  for select using (auth.role() = 'authenticated');

-- Создать задачу может любой авторизованный (сам становится автором)
create policy "tasks_insert" on tasks
  for insert with check (auth.uid() = author_id);

-- Редактировать может автор или исполнитель.
-- Разграничение "только статус — только исполнителю" обеспечивается в API (route handler),
-- т.к. RLS policy не различает, какое именно поле меняется в UPDATE.
-- USING проверяет, что редактирующий был причастен к задаче ДО изменения — этого достаточно.
-- WITH CHECK намеренно (true): без него Postgres по умолчанию переиспользует USING и для
-- НОВОЙ строки — тогда исполнитель (не автор), переназначающий задачу на кого-то другого,
-- получал бы "new row violates row-level security policy", хотя API это разрешает.
create policy "tasks_update" on tasks
  for update
  using (auth.uid() = author_id or auth.uid() = assignee_id)
  with check (true);

-- Удалить может автор или исполнитель
create policy "tasks_delete" on tasks
  for delete using (auth.uid() = author_id or auth.uid() = assignee_id);

-- Комментарии видят все, писать может любой авторизованный
create policy "comments_select_all" on task_comments
  for select using (auth.role() = 'authenticated');

create policy "comments_insert" on task_comments
  for insert with check (auth.uid() = author_id);

-- История видна всем (доска общая), пишется системой при изменениях
create policy "history_select_all" on task_history
  for select using (auth.role() = 'authenticated');

create policy "history_insert" on task_history
  for insert with check (auth.role() = 'authenticated');

-- ============================================
-- Автообновление updated_at
-- ============================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ============================================
-- Первый владелец продукта — создай пользователя через
-- Supabase → Authentication → Add user, затем выполни
-- (замени email на реальный):
--
-- insert into employees (id, name, email, specialization, is_owner)
-- select id, 'Твоё имя', email, 'Управление продуктом', true
-- from auth.users where email = 'твой-email@example.com';
-- ============================================

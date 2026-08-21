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
-- Раздел «Проекты» (НИОКР): проекты, договоры, этапы, чек-лист приёмки, комментарии.
-- Доступ — как у задач: видят и редактируют все авторизованные сотрудники.
-- Удалить целый проект может только его создатель или владелец (is_owner).
-- См. supabase-schema-projects.sql — тот же блок, отдельным патчем.
-- ============================================

create table projects (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,              -- "Номер проекта" из реестра — вводится вручную, не auto
  wave int not null check (wave > 0),      -- "конкурсный отбор"
  lot_label text not null default '',      -- "Лот N" как есть, НЕ уникален (повторяется внутри волны)
  code text not null default '',           -- "Шифр" — короткое кодовое имя проекта
  tech_direction text not null default '', -- технологическое направление, свободный текст
  topic text not null default '',          -- Тема НИОКР
  executor_short text not null default '',
  executor_full text not null default '',
  executor_inn text not null default '',
  executor_kpp text not null default '',
  executor_address text not null default '',
  display_order int,                       -- ручной порядок внутри волны (null → сортировка по number)
  protocol_number text not null default '', -- № протокола подведения итогов конкурсного отбора
  protocol_date date,                       -- дата этого протокола
  status text not null default 'active' check (status in ('active', 'terminated')),
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contract_number text not null,
  contract_date date,
  contract_year int,       -- старые импортированные договоры (год); новые заполняют stage_number
  stage_number int,        -- этап проекта, который финансирует договор
  akr text not null default '' check (akr ~ '^[0-9]{0,8}$'), -- Аналитический код раздела — только цифры, не более 8
  created_at timestamptz not null default now()
);

create table project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_number int not null,          -- считается в API-роуте (max+1 по проекту), не триггером
  name text not null default '',      -- пусто → UI показывает "Этап N"
  start_date date,                    -- в реестре отсутствует, nullable
  end_date date,
  cost numeric(14,2),
  technical_summary text not null default '',  -- итог техприёмки, когда этап закрыт
  financial_summary text not null default '',  -- итог финприёмки, когда этап закрыт
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, stage_number)
);

create table project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references project_stages(id) on delete cascade,
  track text not null check (track in ('technical', 'financial')),
  step_order int not null,
  template_key text,                  -- 'tech_1'..'tech_6' / 'fin_1'..'fin_8', null для кастомных
  is_default boolean not null default false,
  title text not null,
  target_date date,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references employees(id) on delete set null,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, track, step_order)
);

-- "Мнение Фонда НТИ" — комментарии сотрудников по проекту (не по этапу/шагу)
create table project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  author_id uuid references employees(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

create table project_views (
  project_id uuid not null references projects(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (project_id, employee_id)
);

create index idx_projects_wave on projects(wave, number);
create index idx_contracts_project on project_contracts(project_id);
create index idx_stages_project on project_stages(project_id);
create index idx_checklist_stage on project_checklist_items(stage_id, track, step_order);
create index idx_comments_project on project_comments(project_id, created_at);

create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger project_stages_updated_at before update on project_stages
  for each row execute function set_updated_at();
create trigger project_checklist_items_updated_at before update on project_checklist_items
  for each row execute function set_updated_at();

create or replace function protect_project_fields()
returns trigger as $$
begin
  new.number := old.number;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$ language plpgsql;

create trigger protect_project_fields before update on projects
  for each row execute function protect_project_fields();

alter table projects enable row level security;
alter table project_contracts enable row level security;
alter table project_stages enable row level security;
alter table project_checklist_items enable row level security;
alter table project_comments enable row level security;
alter table project_views enable row level security;

create policy "projects_select_all" on projects for select using (auth.role() = 'authenticated');
create policy "projects_insert_all" on projects for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
create policy "projects_update_all" on projects for update using (auth.role() = 'authenticated') with check (true);
create policy "projects_delete_owner_only" on projects for delete using (
  exists (select 1 from employees e where e.id = auth.uid() and e.is_owner)
);

create policy "contracts_select_all" on project_contracts for select using (auth.role() = 'authenticated');
create policy "contracts_insert_all" on project_contracts for insert with check (auth.role() = 'authenticated');
create policy "contracts_update_all" on project_contracts for update using (auth.role() = 'authenticated') with check (true);
create policy "contracts_delete_all" on project_contracts for delete using (auth.role() = 'authenticated');

create policy "project_stages_select_all" on project_stages for select using (auth.role() = 'authenticated');
create policy "project_stages_insert_all" on project_stages for insert with check (auth.role() = 'authenticated');
create policy "project_stages_update_all" on project_stages for update using (auth.role() = 'authenticated') with check (true);
create policy "project_stages_delete_all" on project_stages for delete using (auth.role() = 'authenticated');

create policy "checklist_select_all" on project_checklist_items for select using (auth.role() = 'authenticated');
create policy "checklist_insert_all" on project_checklist_items for insert with check (auth.role() = 'authenticated');
create policy "checklist_update_all" on project_checklist_items for update using (auth.role() = 'authenticated') with check (true);
create policy "checklist_delete_all" on project_checklist_items for delete using (auth.role() = 'authenticated');

create policy "project_comments_select_all" on project_comments for select using (auth.role() = 'authenticated');
create policy "project_comments_insert" on project_comments for insert with check (auth.uid() = author_id);
create policy "project_comments_delete_own" on project_comments for delete using (auth.uid() = author_id);

create policy "project_views_select_own" on project_views for select using (auth.uid() = employee_id);
create policy "project_views_insert_own" on project_views for insert with check (auth.uid() = employee_id);
create policy "project_views_update_own" on project_views for update using (auth.uid() = employee_id);

-- ============================================
-- Первый владелец продукта — создай пользователя через
-- Supabase → Authentication → Add user, затем выполни
-- (замени email на реальный):
--
-- insert into employees (id, name, email, specialization, is_owner)
-- select id, 'Твоё имя', email, 'Управление продуктом', true
-- from auth.users where email = 'твой-email@example.com';
-- ============================================

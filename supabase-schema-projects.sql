-- ============================================
-- Раздел «Проекты» (НИОКР): проекты, договоры, этапы, чек-лист приёмки, комментарии.
-- Доступ — как у задач: видят и редактируют все авторизованные сотрудники.
-- Удалить целый проект может только его создатель или владелец (is_owner).
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
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

-- Отметки "просмотрено" для непрочитанных комментариев — 1:1 с task_views (supabase-schema-task-views.sql)
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

-- ============================================
-- updated_at — переиспользуем существующую set_updated_at() (см. supabase-schema-final.sql)
-- ============================================
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger project_stages_updated_at before update on project_stages
  for each row execute function set_updated_at();
create trigger project_checklist_items_updated_at before update on project_checklist_items
  for each row execute function set_updated_at();

-- number/created_by/created_at неизменяемы после создания. RLS WITH CHECK не умеет
-- сравнивать новое значение со старым по отдельной колонке — та же причина, что и у
-- protect_employee_fields() в supabase-schema-final.sql.
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

-- ============================================
-- RLS — как у задач: смотрят и правят все авторизованные, удаление проекта уже
-- только создателю/владельцу. Явная policy на КАЖДУЮ операцию для каждой таблицы —
-- Postgres по умолчанию запрещает то, для чего нет policy (этот проект уже дважды
-- на этом спотыкался: tasks_update, employees update).
-- ============================================
alter table projects enable row level security;
alter table project_contracts enable row level security;
alter table project_stages enable row level security;
alter table project_checklist_items enable row level security;
alter table project_comments enable row level security;
alter table project_views enable row level security;

create policy "projects_select_all" on projects for select using (auth.role() = 'authenticated');
create policy "projects_insert_all" on projects for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
create policy "projects_update_all" on projects for update using (auth.role() = 'authenticated') with check (true);
create policy "projects_delete_creator_or_owner" on projects for delete using (
  auth.uid() = created_by or exists (select 1 from employees e where e.id = auth.uid() and e.is_owner)
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
-- done_by/done_at сознательно не проверяются здесь (сломало бы правку комментария в
-- уже отмеченном чужом шаге) — сервер сам подставляет их из getCurrentEmployee(),
-- никогда не доверяя телу запроса, как уже сделано для is_owner/email у employees.
create policy "checklist_update_all" on project_checklist_items for update using (auth.role() = 'authenticated') with check (true);
create policy "checklist_delete_all" on project_checklist_items for delete using (auth.role() = 'authenticated');

create policy "project_comments_select_all" on project_comments for select using (auth.role() = 'authenticated');
create policy "project_comments_insert" on project_comments for insert with check (auth.uid() = author_id);
create policy "project_comments_delete_own" on project_comments for delete using (auth.uid() = author_id);

create policy "project_views_select_own" on project_views for select using (auth.uid() = employee_id);
create policy "project_views_insert_own" on project_views for insert with check (auth.uid() = employee_id);
create policy "project_views_update_own" on project_views for update using (auth.uid() = employee_id);

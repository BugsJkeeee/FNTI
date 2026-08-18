-- ============================================
-- СХЕМА: теги задач (видны только внутри самой задачи, много-ко-многим)
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- ============================================

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table task_tags (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

alter table tags enable row level security;
alter table task_tags enable row level security;

-- Теги видят все авторизованные, добавлять может любой сотрудник
create policy "tags_select_all" on tags
  for select using (auth.role() = 'authenticated');

create policy "tags_insert_any" on tags
  for insert with check (auth.uid() = created_by);

-- Привязка тега к задаче — тоже открыта для любого сотрудника (и снять тег тоже)
create policy "task_tags_select_all" on task_tags
  for select using (auth.role() = 'authenticated');

create policy "task_tags_insert_any" on task_tags
  for insert with check (auth.role() = 'authenticated');

create policy "task_tags_delete_any" on task_tags
  for delete using (auth.role() = 'authenticated');

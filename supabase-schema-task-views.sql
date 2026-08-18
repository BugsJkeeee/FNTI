-- ============================================
-- СХЕМА: отметки "просмотрено" для непрочитанных комментариев
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- ============================================

create table task_views (
  task_id uuid not null references tasks(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (task_id, employee_id)
);

alter table task_views enable row level security;

create policy "task_views_select_own" on task_views
  for select using (auth.uid() = employee_id);

create policy "task_views_insert_own" on task_views
  for insert with check (auth.uid() = employee_id);

create policy "task_views_update_own" on task_views
  for update using (auth.uid() = employee_id);

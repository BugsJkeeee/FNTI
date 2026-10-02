-- РИД проектов (выгрузка «Реестр РИД» НИОКР БАС) + дата карточки ЕГИСУ НИОКТР у проекта.
-- Грузится скриптом scripts/import-rids.mjs. Применено через Supabase MCP (миграции project_rids,
-- rids_application_date_egisu_date).
create table project_rids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null default '',
  title text not null default '',
  application_number text not null default '',
  application_date date,
  document_number text not null default '',
  action_status text not null default '',
  egisu_created_number text not null default '',
  egisu_created_date date,
  egisu_protection_number text not null default '',
  egisu_protection_date date,
  egisu_usage_number text not null default '',
  egisu_usage_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_rids_project_id_idx on project_rids(project_id);

alter table project_rids enable row level security;
create policy "project_rids_select" on project_rids for select using (auth.role() = 'authenticated');
create policy "project_rids_insert" on project_rids for insert with check (auth.role() = 'authenticated');
create policy "project_rids_update" on project_rids for update using (auth.role() = 'authenticated') with check (true);
create policy "project_rids_delete" on project_rids for delete using (auth.role() = 'authenticated');

create trigger project_rids_updated_at before update on project_rids
  for each row execute function set_updated_at();

alter table projects add column if not exists egisu_date date;

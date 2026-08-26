-- ============================================
-- План субсидии по направлению (technology direction) на год — вводится вручную,
-- отдельно от суммы обязательств по уже заведённым в БД проектам (сверочная величина
-- из официальных документов). Используется в портфельной аналитике (`/analytics`).
-- Применено через официальный Supabase MCP (apply_migration), не через ручной pg-скрипт.
-- ============================================

create table direction_subsidy_plans (
  id uuid primary key default gen_random_uuid(),
  tech_direction text not null,
  year int not null,
  amount numeric(14,2) not null default 0,
  updated_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tech_direction, year)
);

alter table direction_subsidy_plans enable row level security;

create policy "direction_subsidy_plans_select_all" on direction_subsidy_plans
  for select using (auth.role() = 'authenticated');
create policy "direction_subsidy_plans_insert_all" on direction_subsidy_plans
  for insert with check (auth.role() = 'authenticated');
create policy "direction_subsidy_plans_update_all" on direction_subsidy_plans
  for update using (auth.role() = 'authenticated') with check (true);
create policy "direction_subsidy_plans_delete_all" on direction_subsidy_plans
  for delete using (auth.role() = 'authenticated');

create trigger direction_subsidy_plans_updated_at before update on direction_subsidy_plans
  for each row execute function set_updated_at();

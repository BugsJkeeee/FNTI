-- ФЭО проектов (финансово-экономическое обоснование) — загружается скриптом scripts/import-feo.mjs
-- из итоговых ФЭО в папках «04.01_Исполнители НИОКР 2024\ФЭО» и «04.02 ...\_Итоговые ФЭО - только xls».
-- Одна загруженная версия на проект (повторная загрузка заменяет её целиком).
--
-- feo_documents — файл и общие сведения;
-- feo_sheets    — видимые листы в «очищенном» виде для показа как в Excel (шапка + строки с данными);
-- feo_plan_items / feo_expenses / feo_purchases — те же данные, приведённые к единым полям
--                 (подэтапы плана, статьи расходов по годам, закупки) для поиска и сводок.
-- Суммы в нормализованных таблицах — в рублях (тыс. руб. из ФЭО 2024 года пересчитаны).
-- Пишет только загрузчик (service role, RLS не действует) — сотрудникам нужен только select.

create table feo_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  template text not null check (template in ('2024', '2025')),
  file_name text not null,
  source_path text not null default '',
  file_modified_at timestamptz,
  info jsonb not null default '[]',   -- [{label, value}] из «Основной информации»
  checks jsonb not null default '[]', -- [{level: 'warn'|'info', text}] — несостыковки, найденные при загрузке
  loaded_at timestamptz not null default now()
);

create table feo_sheets (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references feo_documents(id) on delete cascade,
  sort int not null,
  name text not null,                 -- имя листа в Excel
  caption text not null default '',   -- заголовок над таблицей
  cols jsonb not null default '[]',   -- [{w: ширина, num: bool}]
  header jsonb not null default '[]', -- строки шапки: [[{t, cs, rs}]]
  rows jsonb not null default '[]'    -- [{c: [значения], b?: true, l?: уровень}]
);
create index feo_sheets_document_id_idx on feo_sheets(document_id);

create table feo_plan_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references feo_documents(id) on delete cascade,
  sort int not null,
  code text not null default '',
  level smallint not null default 1,
  name text not null default '',
  content text not null default '',
  results text not null default '',
  executor text not null default '',
  start_date date,
  end_date date
);
create index feo_plan_items_document_id_idx on feo_plan_items(document_id);

create table feo_expenses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references feo_documents(id) on delete cascade,
  sort int not null,
  code text not null default '',
  name text not null default '',
  unit text not null default '',
  amounts jsonb not null default '{}', -- {"2025": 123.45, ...}
  total numeric
);
create index feo_expenses_document_id_idx on feo_expenses(document_id);

create table feo_purchases (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references feo_documents(id) on delete cascade,
  sort int not null,
  sheet text not null default '',
  category text not null default '',   -- материалы / оборудование / ПО / услуги / командировки …
  object_type text not null default '',
  substage_code text not null default '', -- подэтап (есть только в форме 2025 года)
  name text not null default '',
  purpose text not null default '',
  unit text not null default '',
  amounts jsonb not null default '{}', -- по годам (форма 2024), {} если год не указан
  total numeric,
  justification text not null default ''
);
create index feo_purchases_document_id_idx on feo_purchases(document_id);

alter table feo_documents enable row level security;
alter table feo_sheets enable row level security;
alter table feo_plan_items enable row level security;
alter table feo_expenses enable row level security;
alter table feo_purchases enable row level security;
create policy "feo_documents_select" on feo_documents for select using ((select auth.role()) = 'authenticated');
create policy "feo_sheets_select" on feo_sheets for select using ((select auth.role()) = 'authenticated');
create policy "feo_plan_items_select" on feo_plan_items for select using ((select auth.role()) = 'authenticated');
create policy "feo_expenses_select" on feo_expenses for select using ((select auth.role()) = 'authenticated');
create policy "feo_purchases_select" on feo_purchases for select using ((select auth.role()) = 'authenticated');

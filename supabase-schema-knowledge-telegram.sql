-- ============================================
-- СХЕМА: база знаний проекта (глоссарий) + привязка Telegram
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- (дополняет supabase-schema-final.sql, ничего из него не удаляет)
-- ============================================

-- ---------- Глоссарий проекта ----------
create table glossary_entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references employees(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

alter table glossary_entries enable row level security;

-- Читают все авторизованные — текст целиком подставляется в промпт ИИ
create policy "glossary_select_all" on glossary_entries
  for select using (auth.role() = 'authenticated');

-- Добавить запись может любой участник, сам становится автором
create policy "glossary_insert" on glossary_entries
  for insert with check (auth.uid() = author_id);

-- Удалить может автор записи или владелец продукта
create policy "glossary_delete_own" on glossary_entries
  for delete using (
    auth.uid() = author_id
    or exists (select 1 from employees e where e.id = auth.uid() and e.is_owner = true)
  );

-- ---------- Привязка Telegram ----------
alter table employees add column telegram_chat_id bigint;
alter table employees add column telegram_link_code text unique;

-- Примечание: обновление этих полей делается через service-role (admin) клиент
-- в route handler'ах (app/api/telegram/*), т.к. для employees нет RLS-policy
-- на update (тот же пробел уже есть у specialization в ProfileForm — не трогаем).

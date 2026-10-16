-- ============================================
-- ДОСТУП ТОЛЬКО НА ЧТЕНИЕ для Telegram-бота на базе Claude Code (см. telegram-bot/README.md)
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run. Можно запускать повторно.
--
-- Роль claude_reader:
--  * не может ничего менять (нет INSERT/UPDATE/DELETE, плюс сессия принудительно read-only);
--  * видит только перечисленные ниже таблицы и только безопасные колонки employees
--    (без telegram_chat_id / telegram_link_code);
--  * RLS на таблицах включён, поэтому каждой таблице нужна SELECT-policy именно для этой роли —
--    без неё Postgres молча вернёт 0 строк.
--
-- Пароль здесь НЕ задаётся: пока вы не выполните отдельную команду из конца файла,
-- войти под этой ролью невозможно.
-- ============================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'claude_reader') then
    create role claude_reader nologin;
  end if;
end $$;

alter role claude_reader set default_transaction_read_only = on;
alter role claude_reader set statement_timeout = '15s';
alter role claude_reader set idle_in_transaction_session_timeout = '30s';

grant usage on schema public to claude_reader;

-- employees: только безопасные колонки (column-level grant)
grant select (id, name, specialization, is_owner, created_at) on public.employees to claude_reader;

-- Остальные таблицы целиком + SELECT-policy для роли
do $$
declare
  t text;
  tables text[] := array[
    'tasks', 'task_comments', 'task_history', 'tags', 'task_tags', 'glossary_entries',
    'projects', 'project_contracts', 'project_stages', 'project_claims',
    'project_checklist_items', 'project_comments', 'project_payments',
    'project_rids', 'direction_subsidy_plans'
  ];
begin
  foreach t in array tables || array['employees'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'Таблицы public.% нет — пропускаю', t;
      continue;
    end if;

    if t <> 'employees' then
      execute format('grant select on public.%I to claude_reader', t);
    end if;

    execute format('drop policy if exists claude_reader_select on public.%I', t);
    execute format(
      'create policy claude_reader_select on public.%I for select to claude_reader using (true)', t
    );
  end loop;
end $$;

-- ============================================
-- ВАЖНО: пароль задаётся ОТДЕЛЬНОЙ командой — подставьте свой длинный случайный пароль
-- (только латиница и цифры, чтобы не экранировать в строке подключения),
-- выполните её один раз и НЕ сохраняйте в Git:
--
--   alter role claude_reader login password 'ВАШ_ДЛИННЫЙ_ПАРОЛЬ';
--
-- Строка подключения (Supabase → Project Settings → Database → Connection string → Session pooler),
-- логин в ней — claude_reader.<project-ref> (через пулер имя роли пишется с точкой и ref проекта):
--
--   postgresql://claude_reader.<project-ref>:ВАШ_ДЛИННЫЙ_ПАРОЛЬ@<хост-пулера>:5432/postgres
-- ============================================

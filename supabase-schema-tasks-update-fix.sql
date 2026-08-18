-- ============================================
-- ФИКС: исполнитель не мог переназначить задачу на другого человека
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
--
-- Причина: policy "tasks_update" была задана только через USING, без WITH CHECK.
-- Postgres в этом случае по умолчанию применяет то же самое условие USING и к
-- НОВОЙ строке после обновления. Если исполнитель (не автор) переназначал задачу
-- на другого сотрудника, ни "auth.uid() = author_id", ни "auth.uid() = assignee_id"
-- для новой строки уже не выполнялись — Postgres отклонял обновление с ошибкой
-- "new row violates row-level security policy for table tasks", хотя по бизнес-логике
-- (и по проверке в API route handler'е) исполнитель имеет право менять задачу.
--
-- Проверка "кто может редактировать" остаётся в USING (по старому владению задачей
-- ДО изменения) — этого достаточно, WITH CHECK (true) просто не дублирует её на новую строку.
-- ============================================

drop policy if exists "tasks_update" on tasks;

create policy "tasks_update" on tasks
  for update
  using (auth.uid() = author_id or auth.uid() = assignee_id)
  with check (true);

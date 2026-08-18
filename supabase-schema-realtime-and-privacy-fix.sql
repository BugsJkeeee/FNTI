-- ============================================
-- 1) ФИКС ПРИВАТНОСТИ: tasks_select_all разрешала ЛЮБОМУ авторизованному читать
-- вообще все задачи через RLS — приватность тега "личное" соблюдалась только
-- в коде API (filterVisibleTasks в lib/tags.ts), а не в самой базе. Значит,
-- прямой запрос к Supabase REST в обход Next.js API мог показать чужие
-- приватные задачи. Теперь это закрыто на уровне RLS — той же логикой,
-- что уже используется в lib/tags.ts (isPrivateTask/isTaskOwner).
--
-- 2) REALTIME: включаем публикацию для tasks, чтобы клиенты могли подписаться
-- на INSERT через Supabase Realtime (нужно для live-обновления списка задач
-- и появления котика при создании новой задачи). Realtime уважает RLS —
-- значит фикс приватности выше защищает и обычные запросы, и realtime-эфир
-- одинаково: приватную задачу не увидит и не получит по подписке никто,
-- кроме автора/исполнителя.
--
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- ============================================

drop policy if exists "tasks_select_all" on tasks;
create policy "tasks_select_all" on tasks
  for select using (
    auth.role() = 'authenticated'
    and (
      auth.uid() = author_id
      or auth.uid() = assignee_id
      or not exists (
        select 1
        from task_tags tt
        join tags tg on tg.id = tt.tag_id
        where tt.task_id = tasks.id and lower(trim(tg.name)) = 'личное'
      )
    )
  );

alter publication supabase_realtime add table tasks;

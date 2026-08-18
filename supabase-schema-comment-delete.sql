-- ============================================
-- СХЕМА: разрешить автору удалять свой комментарий
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- ============================================

create policy "comments_delete_own" on task_comments
  for delete using (auth.uid() = author_id);

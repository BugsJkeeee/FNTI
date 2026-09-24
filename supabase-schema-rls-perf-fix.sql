-- Перф-фикс RLS-политик и недостающих индексов на FK.
-- Supabase performance advisor: 57 policy используют auth.uid()/auth.role() напрямую,
-- из-за чего Postgres пере-вычисляет их на КАЖДОЙ строке вместо одного раза на запрос.
-- Оборачиваем в (select auth.uid()) / (select auth.role()) — планировщик тогда
-- считает значение один раз (initplan) и переиспользует. Семантика политик не меняется,
-- только скорость. См. https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
--
-- ВАЖНО: после применения прогнать `npm run check:rls` (см. AGENTS.md) — политики
-- меняются через ALTER POLICY, но на всякий случай проверяем, что на все операции
-- по всем таблицам с RLS покрытие не пропало.

-- direction_subsidy_plans
ALTER POLICY direction_subsidy_plans_delete_all ON public.direction_subsidy_plans
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY direction_subsidy_plans_insert_all ON public.direction_subsidy_plans
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY direction_subsidy_plans_select_all ON public.direction_subsidy_plans
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY direction_subsidy_plans_update_all ON public.direction_subsidy_plans
  USING ((select auth.role()) = 'authenticated'::text) WITH CHECK (true);

-- employees
ALTER POLICY employees_owner_insert ON public.employees
  WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = (select auth.uid()) AND e.is_owner = true));
ALTER POLICY employees_select_all ON public.employees
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY employees_update_self ON public.employees
  USING ((select auth.uid()) = id) WITH CHECK (true);

-- glossary_entries
ALTER POLICY glossary_delete_own ON public.glossary_entries
  USING (((select auth.uid()) = author_id) OR EXISTS (SELECT 1 FROM employees e WHERE e.id = (select auth.uid()) AND e.is_owner = true));
ALTER POLICY glossary_insert ON public.glossary_entries
  WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY glossary_select_all ON public.glossary_entries
  USING ((select auth.role()) = 'authenticated'::text);

-- project_checklist_items
ALTER POLICY checklist_delete_all ON public.project_checklist_items
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY checklist_insert_all ON public.project_checklist_items
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY checklist_select_all ON public.project_checklist_items
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY checklist_update_all ON public.project_checklist_items
  USING ((select auth.role()) = 'authenticated'::text) WITH CHECK (true);

-- project_claims
ALTER POLICY claims_delete_all ON public.project_claims
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY claims_insert_all ON public.project_claims
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY claims_select_all ON public.project_claims
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY claims_update_all ON public.project_claims
  USING ((select auth.role()) = 'authenticated'::text) WITH CHECK (true);

-- project_comments
ALTER POLICY project_comments_delete_own ON public.project_comments
  USING ((select auth.uid()) = author_id);
ALTER POLICY project_comments_insert ON public.project_comments
  WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY project_comments_select_all ON public.project_comments
  USING ((select auth.role()) = 'authenticated'::text);

-- project_contracts
ALTER POLICY contracts_delete_all ON public.project_contracts
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY contracts_insert_all ON public.project_contracts
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY contracts_select_all ON public.project_contracts
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY contracts_update_all ON public.project_contracts
  USING ((select auth.role()) = 'authenticated'::text) WITH CHECK (true);

-- project_payments
ALTER POLICY payments_delete_all ON public.project_payments
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY payments_insert_all ON public.project_payments
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY payments_select_all ON public.project_payments
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY payments_update_all ON public.project_payments
  USING ((select auth.role()) = 'authenticated'::text) WITH CHECK (true);

-- project_stages
ALTER POLICY project_stages_delete_all ON public.project_stages
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY project_stages_insert_all ON public.project_stages
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY project_stages_select_all ON public.project_stages
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY project_stages_update_all ON public.project_stages
  USING ((select auth.role()) = 'authenticated'::text) WITH CHECK (true);

-- project_views
ALTER POLICY project_views_insert_own ON public.project_views
  WITH CHECK ((select auth.uid()) = employee_id);
ALTER POLICY project_views_select_own ON public.project_views
  USING ((select auth.uid()) = employee_id);
ALTER POLICY project_views_update_own ON public.project_views
  USING ((select auth.uid()) = employee_id);

-- projects
ALTER POLICY projects_delete_owner_only ON public.projects
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = (select auth.uid()) AND e.is_owner));
ALTER POLICY projects_insert_all ON public.projects
  WITH CHECK (((select auth.role()) = 'authenticated'::text) AND (created_by = (select auth.uid())));
ALTER POLICY projects_select_all ON public.projects
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY projects_update_all ON public.projects
  USING ((select auth.role()) = 'authenticated'::text) WITH CHECK (true);

-- tags
ALTER POLICY tags_insert_any ON public.tags
  WITH CHECK ((select auth.uid()) = created_by);
ALTER POLICY tags_select_all ON public.tags
  USING ((select auth.role()) = 'authenticated'::text);

-- task_comments
ALTER POLICY comments_delete_own ON public.task_comments
  USING ((select auth.uid()) = author_id);
ALTER POLICY comments_insert ON public.task_comments
  WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY comments_select_all ON public.task_comments
  USING ((select auth.role()) = 'authenticated'::text);

-- task_history
ALTER POLICY history_insert ON public.task_history
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY history_select_all ON public.task_history
  USING ((select auth.role()) = 'authenticated'::text);

-- task_tags
ALTER POLICY task_tags_delete_any ON public.task_tags
  USING ((select auth.role()) = 'authenticated'::text);
ALTER POLICY task_tags_insert_any ON public.task_tags
  WITH CHECK ((select auth.role()) = 'authenticated'::text);
ALTER POLICY task_tags_select_all ON public.task_tags
  USING ((select auth.role()) = 'authenticated'::text);

-- task_views
ALTER POLICY task_views_insert_own ON public.task_views
  WITH CHECK ((select auth.uid()) = employee_id);
ALTER POLICY task_views_select_own ON public.task_views
  USING ((select auth.uid()) = employee_id);
ALTER POLICY task_views_update_own ON public.task_views
  USING ((select auth.uid()) = employee_id);

-- tasks
ALTER POLICY tasks_delete ON public.tasks
  USING (((select auth.uid()) = author_id) OR ((select auth.uid()) = assignee_id));
ALTER POLICY tasks_insert ON public.tasks
  WITH CHECK ((select auth.uid()) = author_id);
ALTER POLICY tasks_select_all ON public.tasks
  USING (
    ((select auth.role()) = 'authenticated'::text)
    AND (
      ((select auth.uid()) = author_id)
      OR ((select auth.uid()) = assignee_id)
      OR NOT EXISTS (
        SELECT 1 FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id
        WHERE tt.task_id = tasks.id AND lower(trim(tg.name)) = 'личное'
      )
    )
  );
ALTER POLICY tasks_update ON public.tasks
  USING (((select auth.uid()) = author_id) OR ((select auth.uid()) = assignee_id)) WITH CHECK (true);

-- Недостающие индексы на FK (advisor: unindexed_foreign_keys) — ускоряют джойны
-- и .in()/.eq() фильтры по этим колонкам (комментарии, просмотры, история задач и т.д.)
CREATE INDEX IF NOT EXISTS idx_direction_subsidy_plans_updated_by ON public.direction_subsidy_plans(updated_by);
CREATE INDEX IF NOT EXISTS idx_glossary_entries_author_id ON public.glossary_entries(author_id);
CREATE INDEX IF NOT EXISTS idx_project_checklist_items_done_by ON public.project_checklist_items(done_by);
CREATE INDEX IF NOT EXISTS idx_project_comments_author_id ON public.project_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_project_views_employee_id ON public.project_views(employee_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON public.tags(created_by);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id ON public.task_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_changed_by ON public.task_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON public.task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON public.task_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_task_views_employee_id ON public.task_views(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_author_id ON public.tasks(author_id);

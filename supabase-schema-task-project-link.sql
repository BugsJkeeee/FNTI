-- ============================================
-- Привязка задачи (tasks) к проекту НИОКР (projects) — опционально, не все задачи проектные.
-- RLS менять не нужно: политики tasks_* уже разрешают/запрещают по строке (автор/исполнитель),
-- а не по конкретной колонке — новая колонка автоматически попадает под них.
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- ============================================

alter table tasks add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists idx_tasks_project_id on tasks(project_id);

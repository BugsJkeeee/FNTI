-- Краткая карточка проекта по ТЗ (суть, цель, этапы, ключевые требования, РИД).
-- Источник: «_Технические задания проектов НИОКР БАС.md» (папка Фонда). Новых политик не нужно —
-- колонка наследует существующие RLS-политики таблицы projects.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tz_summary jsonb;
COMMENT ON COLUMN public.projects.tz_summary IS 'Краткая карточка проекта по ТЗ: {about, goal, stages, requirements, rid}';

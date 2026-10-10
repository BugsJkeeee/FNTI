-- «Соглашение РИД» — одно соглашение на проект (номер + дата). Источник: «Реестр_договоров_2024-2025.xlsx»,
-- вид документа «Соглашение» (ФС-25/NNN, 3-я волна). Политики не меняются — колонки наследуют RLS таблицы projects.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS rid_agreement_number text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS rid_agreement_date date;
COMMENT ON COLUMN public.projects.rid_agreement_number IS 'Соглашение РИД: номер (одно на проект)';
COMMENT ON COLUMN public.projects.rid_agreement_date IS 'Соглашение РИД: дата (одно на проект)';

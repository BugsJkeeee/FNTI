-- ============================================
-- СХЕМА: сквозной номер задачи (#1, #2, ...)
-- Выполнить весь файл целиком в Supabase → SQL Editor → Run
-- ============================================

alter table tasks add column number bigint;

with numbered as (
  select id, row_number() over (order by created_at) as rn
  from tasks
)
update tasks set number = numbered.rn
from numbered
where tasks.id = numbered.id;

create sequence tasks_number_seq owned by tasks.number;
select setval('tasks_number_seq', coalesce((select max(number) from tasks), 0));

alter table tasks alter column number set default nextval('tasks_number_seq');
alter table tasks alter column number set not null;
alter table tasks add constraint tasks_number_unique unique (number);

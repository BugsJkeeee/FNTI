<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## После любых правок supabase-schema*.sql

Postgres по умолчанию **запрещает** операцию на таблице, если для неё нет ни одной RLS-policy —
это дважды тихо ломало фичи в этом проекте (`tasks_update`, `employees` update). После любого
изменения схемы/политик прогони `npm run check:rls` (нужен `SUPABASE_DB_URL` в `.env.local` —
см. `.env.local.example`) и убедись, что для каждой таблицы с RLS есть policy на все операции,
которые реально используются в коде.

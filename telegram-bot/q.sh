#!/usr/bin/env bash
# Единственная точка доступа бота к базе: ./q.sh "select ..."
# Строка подключения лежит вне рабочей папки бота (~/.config/taskbot/db_url, chmod 600),
# а подключение идёт под ролью claude_reader (только SELECT) в read-only транзакции.
set -euo pipefail

URL_FILE="${TASKBOT_DB_URL_FILE:-$HOME/.config/taskbot/db_url}"
[ -r "$URL_FILE" ] || { echo "Нет файла со строкой подключения: $URL_FILE" >&2; exit 1; }
[ "$#" -eq 1 ] || { echo "Использование: ./q.sh \"<один SQL-запрос или \\d таблица>\"" >&2; exit 1; }

export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000'
exec psql "$(cat "$URL_FILE")" --no-psqlrc -v ON_ERROR_STOP=1 -P pager=off -c "$1"

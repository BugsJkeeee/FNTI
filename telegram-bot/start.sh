#!/usr/bin/env bash
# Запускает Claude Code с Telegram-каналом в tmux-сессии "taskbot".
# Безопасно вызывать повторно (из cron): если сессия уже жива — ничего не делает.
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"

tmux has-session -t taskbot 2>/dev/null && exit 0
tmux new-session -d -s taskbot -c "$PWD" \
  "claude --channels plugin:telegram@claude-plugins-official; echo 'claude завершился, жду перезапуска из cron'; sleep 30"

# Заливает папку бота на VPS и перезапускает сессию Claude Code.
# Запуск (PowerShell, из любой папки):
#   .\telegram-bot\deploy.ps1                    # спросит адрес VPS
#   $env:TASKBOT_HOST = '1.2.3.4'; .\telegram-bot\deploy.ps1
#   .\telegram-bot\deploy.ps1 -NoRestart         # только залить файлы, бота не перезапускать
#
# Секретов в скрипте нет: токен бота и строка подключения лежат на сервере и не затрагиваются.
# Скрипт спросит пароль root от VPS (дважды: scp и ssh). Чтобы не вводить его, настройте вход по SSH-ключу.
# Файлы на сервере перезаписываются, но не удаляются: лишнее (например .claude/settings.local.json) остаётся.

param(
  [string]$Server = $env:TASKBOT_HOST,
  [switch]$NoRestart
)

$ErrorActionPreference = 'Stop'

if (-not $Server) { $Server = Read-Host 'IP или хост VPS' }
if (-not $Server) { throw 'Адрес VPS не указан.' }

$dest  = '/home/taskbot/taskbot'
$stage = '/tmp/taskbot-src-' + [guid]::NewGuid().ToString('N').Substring(0, 8)

Write-Host "1/3 Копирую telegram-bot на ${Server}:$stage ..."
scp -r $PSScriptRoot "root@${Server}:$stage"
if ($LASTEXITCODE -ne 0) { throw 'scp завершился с ошибкой.' }

$steps = @(
  'set -e',
  ('mkdir -p ' + $dest),
  ('cp -a ' + $stage + '/. ' + $dest + '/'),
  ('rm -rf ' + $stage),
  ('rm -f ' + $dest + '/deploy.ps1'),
  ('find ' + $dest + ' -name ''*.sh'' -exec sed -i ''s/\r$//'' {} +'),
  ('chown -R taskbot:taskbot ' + $dest),
  ('chmod -R go-rwx ' + $dest),
  ('chmod 700 ' + $dest + '/q.sh ' + $dest + '/start.sh')
)

if (-not $NoRestart) {
  $steps += @(
    'su - taskbot -c ''tmux kill-session -t taskbot 2>/dev/null; true''',
    'su - taskbot -c ''~/taskbot/start.sh''',
    'sleep 2',
    'su - taskbot -c ''tmux ls'''
  )
}

Write-Host '2/3 Выставляю права' $(if ($NoRestart) { '(без перезапуска бота)' } else { 'и перезапускаю бота' }) '...'
ssh "root@$Server" ($steps -join '; ')
if ($LASTEXITCODE -ne 0) { throw 'Команды на сервере завершились с ошибкой.' }

Write-Host '3/3 Готово.'
if ($NoRestart) {
  Write-Host 'Бот перезапущен не был: изменения в CLAUDE.md и .claude/ подхватятся после перезапуска (tmux kill-session -t taskbot под taskbot).'
} else {
  Write-Host 'В выводе выше должна быть сессия taskbot. Проверьте бота вопросом в Telegram.'
}

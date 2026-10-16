# Telegram-бот на Claude Code (вариант A)

Вы пишете боту в Telegram → сообщение попадает в сессию Claude Code на вашем VPS →
Claude читает базу Supabase **только на чтение** → отвечает в Telegram.
Работает от подписки Claude (Pro/Max), отдельный API-ключ не нужен.

> Это **новый** бот, отдельный от того, что шлёт дайджест с сайта (`app/api/telegram/*`).
> У дайджест-бота стоит вебхук, а канал Claude Code работает через polling — на одном токене они конфликтуют.

## Что где лежит
| Файл | Назначение |
|---|---|
| `../supabase-schema-claude-reader.sql` | роль `claude_reader` (только SELECT) — выполнить в Supabase |
| `CLAUDE.md` | инструкции и описание схемы для бота |
| `.claude/settings.json` | права: разрешён только `./q.sh`, запрещены правки, сеть, чтение секретов |
| `q.sh` | единственный путь к базе (psql, read-only) |
| `start.sh` | запуск Claude Code в tmux, безопасно вызывать из cron |

## Шаг 1. Supabase: read-only роль (на своём компьютере)
1. Supabase → SQL Editor → вставить и выполнить `supabase-schema-claude-reader.sql`.
2. Отдельным запросом (пароль придумайте длинный, латиница+цифры, в Git не сохранять):
   ```sql
   alter role claude_reader login password 'ВАШ_ДЛИННЫЙ_ПАРОЛЬ';
   ```
3. Supabase → Project Settings → Database → Connection string → **Session pooler**. Возьмите строку и замените пользователя на `claude_reader.<project-ref>` и пароль на свой.
4. Проверка прав (под обычным пользователем-админом в SQL Editor):
   ```sql
   set role claude_reader;
   select count(*) from tasks;           -- должно вернуть число, не 0 (если задачи есть)
   select telegram_chat_id from employees limit 1;  -- должна быть ошибка permission denied
   reset role;
   ```
5. `npm run check:rls` — убедиться, что новые policy ничего не сломали.

## Шаг 2. Telegram: новый бот
В [@BotFather](https://t.me/BotFather): `/newbot` → имя и username на `bot` → сохранить токен.

## Шаг 3. VPS (Linux, по SSH)
```bash
# зависимости
sudo apt update && sudo apt install -y tmux postgresql-client unzip
curl -fsSL https://bun.sh/install | bash        # нужен плагину Telegram
claude --version                                  # нужна версия 2.1.80+ ; логин по подписке: claude → /login

# рабочая папка бота (скопируйте папку telegram-bot с компьютера, например через scp)
scp -r telegram-bot user@vps:~/taskbot
chmod +x ~/taskbot/q.sh ~/taskbot/start.sh

# строка подключения — ВНЕ рабочей папки бота
mkdir -p ~/.config/taskbot && chmod 700 ~/.config/taskbot
nano ~/.config/taskbot/db_url        # одна строка: postgresql://claude_reader.<ref>:ПАРОЛЬ@<pooler>:5432/postgres
chmod 600 ~/.config/taskbot/db_url

# проверка: должен вернуть число задач
cd ~/taskbot && ./q.sh "select count(*) from tasks"
# запись должна быть запрещена:
./q.sh "update tasks set text = text"        # ожидаем ошибку
```

## Шаг 4. Подключить Telegram-канал (один раз, вручную)
```bash
cd ~/taskbot
claude
```
Внутри Claude Code:
```
/plugin install telegram@claude-plugins-official     # область: user
/telegram:configure <ТОКЕН_ОТ_BOTFATHER>
```
Выйти (`/exit`) и запустить с каналом:
```bash
claude --channels plugin:telegram@claude-plugins-official
```
Написать боту в Telegram любое сообщение → он пришлёт код → в сессии:
```
/telegram:access pair <код>
/telegram:access policy allowlist
```
Чтобы пустить коллег, повторите пару для их аккаунтов (каждый пишет боту, вы подтверждаете код).
**Учтите:** тот, кто в списке, может ещё и подтверждать запросы разрешений в сессии — добавляйте только тех, кому доверяете.

Задайте боту тестовый вопрос. При первом ответе Claude может спросить разрешение на инструмент
`reply` — выберите «Yes, don't ask again», иначе сессия будет ждать вас на каждом сообщении.

## Шаг 5. Постоянная работа
```bash
cd ~/taskbot && ./start.sh              # запуск в tmux-сессии taskbot
tmux attach -t taskbot                  # посмотреть (выйти: Ctrl+B, потом D)
crontab -e
```
Строки для cron (поднимает бота после перезагрузки и если сессия упала):
```
@reboot   $HOME/taskbot/start.sh
*/5 * * * * $HOME/taskbot/start.sh
```

## Ограничения и заметки
- Канал — research preview: флаг `--channels` и протокол могут измениться; плагины берутся только из списка Anthropic.
- Если Claude внезапно запросит неразрешённое действие, сессия встанет и будет ждать подтверждения в терминале (`tmux attach`). Тогда добавьте это правило в `.claude/settings.json`.
- Контекст сессии со временем разрастается: раз в несколько дней делайте `/clear` внутри tmux или `tmux kill-session -t taskbot` (cron поднимет заново).
- Данные из базы попадают в Anthropic как в любую сессию Claude Code — учитывайте это для персональных/грантовых сведений.
- Подписочный лимит общий с вашим Claude Code: частые вопросы всей команды его расходуют. Если станет тесно — вариант B (свой бот на Vercel с API-ключом).

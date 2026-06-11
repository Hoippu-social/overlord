# Overlord Discord Bot

Overlord - рабочее окружение для Discord-бота и веб-панели управления. В
репозитории лежат runtime бота, Next.js dashboard, локальный Lavalink для музыки,
Prisma-схемы, миграционные скрипты и документация по статистике, тикетам и
эксплуатации проекта.

## Что внутри

| Путь | Назначение |
| --- | --- |
| `bot/` | Discord.js бот: slash-команды, модерация, музыка, аудит, временные голосовые каналы, тикеты, appeals, статистика и bridge API для dashboard. |
| `dashboard/` | Next.js 16 App Router dashboard на порту `3001`: Discord auth, управление серверами, модерация, статистика, тикеты, команды, музыка и системная диагностика. |
| `lavalink/` | Локальный Lavalink-сервер и плагины для музыкального модуля. |
| `docs/` | Runbook'и, аудиты, спецификации и технические заметки. |
| `start*.bat` | Windows-скрипты для локального запуска. |

## Основные возможности

- Discord-бот на `discord.js` со slash-командами.
- Модерация: warnings, mutes, timeouts, bans, история кейсов, appeals,
  audit routes, retention-настройки и опциональная AI-модерация.
- Музыка через Lavalink: queue, loop, shuffle, seek, volume, now playing и
  управление из dashboard.
- Временные голосовые каналы, invite/member activity tracking.
- Статистика с SQLite по умолчанию и инструментами миграции stats workload в
  PostgreSQL.
- Тикет-модуль: настраиваемые панели, категории, live tickets, transcripts,
  dashboard-страницы и bridge между dashboard и ботом.
- Web dashboard с Discord OAuth, guild-scoped layout, global search,
  moderation, stats, tickets, commands, music и system control surfaces.

## Технологии

- Node.js / npm
- TypeScript
- Discord.js 14
- Prisma 5
- SQLite для локальных данных по умолчанию
- Опциональный PostgreSQL для статистики
- Next.js 16, React 19, Tailwind CSS, NextUI
- Lavalink 4 с YouTube/LavaSrc plugins

## Требования

- Windows-окружение для разработки. Встроенные startup-скрипты являются `.bat`
  файлами и рассчитаны на Windows-пути.
- Node.js 20 или новее.
- Java 17 или новее для Lavalink.
- Discord application с bot token, client id, client secret и настроенным OAuth
  redirect URL.
- Установленные npm-зависимости отдельно в `bot/` и `dashboard/`.

## Установка

Установите зависимости в двух приложениях:

```bash
cd bot
npm install

cd ../dashboard
npm install
```

Корневой `package.json` сейчас не заменяет установку зависимостей внутри
`bot/` и `dashboard/`.

## Переменные окружения

Создайте локальные `.env` файлы для бота и dashboard. Секреты нельзя коммитить.

### `bot/.env`

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=optional_test_guild_id_for_guild_command_registration

DATABASE_URL=file:./prisma/development.db
STATS_DATABASE_URL=file:D:/discord_bot/Dev/bot/prisma/stats.db
STATS_DB_PROVIDER=sqlite

DASHBOARD_URL=http://localhost:3001
DASHBOARD_API_PORT=3002
DASHBOARD_API_KEY=change_me

LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass

GEMINI_API_KEY=optional_ai_moderation_key
OPENAI_API_KEY=optional_ai_moderation_key
SPOTIFY_CLIENT_ID=optional_spotify_client_id
SPOTIFY_CLIENT_SECRET=optional_spotify_client_secret
```

### `dashboard/.env`

```env
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=change_me_to_a_long_random_value

DISCORD_CLIENT_ID=your_discord_application_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_TOKEN=your_discord_bot_token

DATABASE_URL=file:../bot/prisma/development.db
STATS_DATABASE_URL=file:D:/discord_bot/Dev/bot/prisma/stats.db
STATS_DB_PROVIDER=sqlite

DASHBOARD_API_URL=http://127.0.0.1:3002
DASHBOARD_API_PORT=3002
DASHBOARD_API_KEY=change_me
DASHBOARD_PASSWORD=optional_local_password_login

LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
```

`DASHBOARD_API_KEY` должен совпадать в обоих файлах, иначе dashboard API routes
не смогут обращаться к локальному bridge API бота.

## Локальный запуск

Обычный порядок запуска:

1. Lavalink
2. Bot
3. Dashboard

Запуск всех компонентов:

```bat
.\start.bat
```

Отдельный запуск:

```bat
.\start_lavalink.bat
.\start_bot.bat
.\start_dashboard.bat
```

Ручной запуск:

```bash
cd lavalink
java -jar Lavalink.jar

cd ../bot
npm run dev

cd ../dashboard
npm run dev
```

Dashboard доступен на <http://localhost:3001>. Bridge API бота по умолчанию
слушает `127.0.0.1:3002`.

## Сборка и проверки

Bot:

```bash
cd bot
npm run build
npm run lint
```

Dashboard:

```bash
cd dashboard
npm run build
npm run lint
```

Обе build-команды генерируют отдельный Prisma client для stats PostgreSQL перед
сборкой. Если используете PostgreSQL-инструменты статистики, заранее настройте
соответствующие переменные окружения.

## База данных

- Основные bot/dashboard данные управляются Prisma через
  `bot/prisma/schema.prisma`.
- В локальной разработке обычно используется SQLite:
  `bot/prisma/development.db`.
- Статистика может работать на SQLite по умолчанию или на PostgreSQL через
  `STATS_PG_DATABASE_URL`.
- Dashboard имеет собственный generate-flow, но основная схема берётся из bot
  workspace.
- Скрипты миграции stats workload в PostgreSQL находятся в `dashboard/scripts/`;
  подробный runbook: `docs/stats-postgres-migration-runbook.md`.

Полезные команды:

```bash
cd bot
npm run stats:pg:generate

cd ../dashboard
npm run stats:pg:doctor
npm run stats:pg:prepare
npm run stats:pg:backfill
npm run stats:pg:parity
```

## Discord setup checklist

- Включите bot token и нужные privileged intents в Discord Developer Portal.
- Настройте OAuth redirects для dashboard, например
  `http://localhost:3001/api/auth/callback/discord`.
- Пригласите бота со scopes `bot` и `applications.commands`.
- Выдайте боту права, необходимые активным модулям:
  - `ViewChannel`
  - `SendMessages`
  - `EmbedLinks`
  - `ManageMessages`
  - `ManageThreads`
  - `CreatePrivateThreads`
  - `SendMessagesInThreads`
  - moderation permissions для включённых модераторских команд

## Рабочий процесс

- Держите изменения бота и dashboard в соответствующих папках.
- Перед публикацией кода запускайте `npm run build` в затронутом workspace.
- После dashboard UI-изменений запускайте `npm run lint` в `dashboard/`.
- Не коммитьте локальные базы данных, generated clients и секреты.
- Для dashboard UI переиспользуйте существующие компоненты и Tailwind token
  system из `AGENTS.md`.
- Для ticket-module изменений держите решения синхронизированными с
  `docs/tickets-module-tech-spec.md`.

## Ветки

`Dev` используется как активная ветка разработки, `Stable` - как более стабильная
линия. На GitHub также могут существовать feature/assistant ветки. Для
документационных backport'ов держите корневой README одинаковым во всех
опубликованных ветках, чтобы новые участники видели актуальные инструкции.

## Лицензия

Код распространяется под AGPL-3.0-or-later. Дополнительные документы по лицензии
и бренду находятся в `LICENSE`, `LICENSING.md`,
`COMMERCIAL-LICENSE-AGREEMENT.md`, `BRAND-ASSETS-LICENSE.md` и `NOTICE`.

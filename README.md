# Overlord Discord Bot

Overlord is a Discord bot plus a Next.js dashboard. Runtime data storage is PostgreSQL-only for both the main bot/dashboard workload and the stats workload.

## Workspaces

| Path | Purpose |
| --- | --- |
| `bot/` | Discord.js bot, slash commands, moderation, music, audit, temp voice, tickets, appeals, stats workers, and the local dashboard bridge API. |
| `dashboard/` | Next.js dashboard on port `3001`: Discord auth, guild-scoped settings, moderation, stats, tickets, commands, music, and system views. |
| `lavalink/` | Local Lavalink server config for the music module. |
| `docs/` | Active specs and operational notes. |
| `archives/legacy-db-rudiment/` | Isolated legacy database artifacts kept only as an archive. Nothing in runtime imports or generates from this directory. |

## Requirements

- Node.js 20 or newer.
- Java 17 or newer for Lavalink.
- PostgreSQL databases for main data and stats.
- Discord application credentials and bot token.

## Environment

`bot/.env` and `dashboard/.env` must both point at PostgreSQL:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/discord_main?schema=public
STATS_PG_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/discord_stats?schema=public
```

The dashboard bridge settings must match in both workspaces:

```env
DASHBOARD_API_URL=http://127.0.0.1:3002
DASHBOARD_API_PORT=3002
DASHBOARD_API_KEY=change_me
```

## Install

```bash
cd bot
npm install

cd ../dashboard
npm install
```

## Local Run

```bat
.\start_lavalink.bat
.\start_bot.bat
.\start_dashboard.bat
```

Dashboard: <http://localhost:3001>
Bot bridge API: `127.0.0.1:3002`

## Database Commands

```bash
cd dashboard
npm run main:pg:push
npm run stats:pg:push
npm run db:postgres-only
```

```bash
cd bot
npm run stats:pg:generate
```

Build commands generate the stats PostgreSQL Prisma client before compiling.

## Checks

```bash
cd dashboard
npm test
npm run build

cd ../bot
npm test
npm run build
```

Do not commit local database dumps, generated migration source clients, or secrets. Legacy database files are retained only under `archives/legacy-db-rudiment/`.

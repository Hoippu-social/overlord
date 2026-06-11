# Overlord Discord Bot

Overlord is a development workspace for a Discord bot and its web dashboard. The
repository contains the bot runtime, a Next.js dashboard, Lavalink binaries for
music playback, Prisma schemas, migration scripts, and operational notes for the
statistics and ticket modules.

## What is inside

| Path | Purpose |
| --- | --- |
| `bot/` | Discord.js bot runtime: slash commands, moderation, music, audit logging, temporary voice, tickets, appeals, statistics, dashboard bridge API. |
| `dashboard/` | Next.js 16 App Router dashboard on port `3001`: Discord auth, guild management UI, moderation settings, stats pages, tickets UI, music controls, system diagnostics. |
| `lavalink/` | Local Lavalink server and plugins used by the music module. |
| `docs/` | Runbooks, audits, specs, and implementation notes. |
| `start*.bat` | Windows convenience scripts for local development. |

## Main features

- Discord slash-command bot built on `discord.js`.
- Moderation workflows: warnings, mutes, timeouts, bans, case history, appeals,
  audit routes, retention settings, and optional AI moderation.
- Music playback through Lavalink with queue, loop, shuffle, seek, volume, now
  playing, and dashboard controls.
- Temporary voice channels and invite/member activity tracking.
- Statistics subsystem with SQLite by default and PostgreSQL migration tooling
  for the stats workload.
- Ticket/support module: configurable panels, categories, live ticket handling,
  transcripts, dashboard pages, and a bot-to-dashboard bridge.
- Web dashboard with Discord OAuth, guild-scoped layouts, global search,
  moderation, stats, tickets, commands, music, and system control surfaces.

## Tech stack

- Node.js / npm
- TypeScript
- Discord.js 14
- Prisma 5
- SQLite for local/default data
- Optional PostgreSQL target for statistics data
- Next.js 16, React 19, Tailwind CSS, NextUI
- Lavalink 4 with YouTube/LavaSrc plugins

## Prerequisites

- Windows development environment. The included startup scripts are `.bat`
  files and assume Windows paths.
- Node.js 20 or newer is recommended.
- Java 17 or newer for Lavalink.
- A Discord application with bot token, client id, client secret, and configured
  OAuth redirect URL.
- npm dependencies installed in both `bot/` and `dashboard/`.

## Installation

Install dependencies separately for the bot and dashboard:

```bash
cd bot
npm install

cd ../dashboard
npm install
```

The repository root currently only carries shared metadata and does not replace
the package installs inside the two applications.

## Environment

Create local `.env` files for the bot and dashboard. Do not commit secrets.

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

Use the same `DASHBOARD_API_KEY` in both files so dashboard API routes can call
the local bot bridge.

## Local startup

The usual local startup order is:

1. Lavalink
2. Bot
3. Dashboard

Run everything with:

```bat
.\start.bat
```

Or run components separately:

```bat
.\start_lavalink.bat
.\start_bot.bat
.\start_dashboard.bat
```

Manual commands:

```bash
cd lavalink
java -jar Lavalink.jar

cd ../bot
npm run dev

cd ../dashboard
npm run dev
```

The dashboard is available at <http://localhost:3001>. The bot bridge listens on
`127.0.0.1:3002` by default.

## Build and checks

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

Both build commands generate the dedicated stats PostgreSQL Prisma client before
building. Make sure stats-related environment variables are set if you use the
PostgreSQL tooling.

## Database notes

- Main bot/dashboard data is managed by Prisma through `bot/prisma/schema.prisma`.
- Local development commonly uses SQLite through `bot/prisma/development.db`.
- Statistics can use SQLite by default or PostgreSQL through
  `STATS_PG_DATABASE_URL`.
- The dashboard has its own Prisma generation flow, but the main schema is shared
  from the bot workspace.
- Stats PostgreSQL migration helpers live in `dashboard/scripts/`; see
  `docs/stats-postgres-migration-runbook.md`.

Useful commands:

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

- Enable the bot token and required privileged intents in the Discord Developer
  Portal.
- Configure OAuth redirects for the dashboard, for example
  `http://localhost:3001/api/auth/callback/discord`.
- Invite the bot with application command and bot scopes.
- Give the bot permissions needed by active modules:
  - `ViewChannel`
  - `SendMessages`
  - `EmbedLinks`
  - `ManageMessages`
  - `ManageThreads`
  - `CreatePrivateThreads`
  - `SendMessagesInThreads`
  - moderation permissions required by enabled moderation commands

## Development workflow

- Keep bot and dashboard changes scoped to their folders.
- Use `npm run build` in the affected workspace before publishing code changes.
- Run `npm run lint` in `dashboard/` after dashboard UI edits.
- Do not commit generated local databases or secrets.
- For dashboard UI work, reuse the existing components and Tailwind token system
  described in `AGENTS.md`.
- For ticket-module work, keep the technical decisions aligned with
  `docs/tickets-module-tech-spec.md`.

## Branches

The repository currently uses `Dev` for active development and `Stable` for the
more stable line. Feature and assistant branches may exist on GitHub as needed.
When backporting documentation-only updates, apply the same README to every
published branch so newcomers see consistent setup instructions.

## Licensing

The code is licensed under AGPL-3.0-or-later. Additional licensing and brand
documents are available in `LICENSE`, `LICENSING.md`,
`COMMERCIAL-LICENSE-AGREEMENT.md`, `BRAND-ASSETS-LICENSE.md`, and `NOTICE`.

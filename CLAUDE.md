# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Overlord** is a Discord bot + web management dashboard. It is structured as a monorepo with three independently-runnable components:

- `bot/` — Discord.js v14 bot (TypeScript/Node.js). Handles all Discord interactions, music playback, moderation, audit logging, and exposes an internal HTTP API for the dashboard.
- `dashboard/` — Next.js 16 web dashboard (React 19, TypeScript). Guild management UI with Discord OAuth2 authentication.
- `lavalink/` — Pre-compiled Lavalink Java audio server. Handles audio processing for music commands.

The bot and dashboard share a single SQLite database (Prisma ORM, schema at `bot/prisma/schema.prisma`).

---

## Commands

### Bot (`cd bot`)

```bash
npm install
npm run dev        # development with nodemon auto-reload
npm run build      # tsc compile to dist/
npm start          # run compiled dist/index.js
npm run lint       # ESLint
npm run format     # Prettier
```

Database:
```bash
npx prisma generate   # regenerate Prisma client after schema changes
npx prisma db push    # apply schema to the SQLite database (no migration files)
npx prisma studio     # GUI database browser
```

### Dashboard (`cd dashboard`)

```bash
npm install
npm run dev     # Next.js dev server on port 3001
npm run build
npm start       # production on port 3001
npm run lint
```

### Lavalink

```bash
cd lavalink && java -jar Lavalink.jar
```

Requires Java 11+. Config: `lavalink/application.yml`. Default port: `2334`, password: `youshallnotpass`.

---

## Environment Variables

**`bot/.env`**
```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=          # optional: scopes slash command registration to one guild for faster dev iteration
DATABASE_URL=file:./prisma/development.db
GEMINI_API_KEY=    # Google Generative AI for content moderation
```

**`dashboard/.env.local`**
```
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
NEXTAUTH_SECRET=   # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3001
```

No `.env.example` files exist — create them manually.

---

## Architecture

### Bot

**Startup sequence** (`bot/src/index.ts`):
1. Connect to SQLite via Prisma (`utils/database.ts`)
2. Initialize Lavalink manager (`utils/LavalinkManager.ts`)
3. Dynamically load events from `events/` and commands from `commands/` via handlers
4. `client.login()` → on `ready`: initialize Lavalink with bot identity, start the dashboard HTTP API server (`utils/dashboardApi.ts`), sync all guild data to DB, reconcile temp voice rooms, prime invite cache

**Command loading**: `handlers/commandHandler.ts` walks `commands/` subdirectories and registers slash commands. Each command file exports a `data` (SlashCommandBuilder) and `execute` function. The `Command` interface is defined in `utils/types.ts`.

**Event loading**: `handlers/eventHandler.ts` walks `events/` subdirectories and attaches listeners. The `interactionCreate` handler in `index.ts` itself handles modal submits, string select menus, and button presses — routing to the Lavalink player as needed.

**Music**: The bot maintains one Lavalink player per guild via `lavalink-client`. The `MusicPlayerHandler` class (`utils/MusicPlayerHandler.ts`) manages the "Now Playing" embed with playback controls. Player state is also written to the `MusicNowPlaying` DB table for the dashboard to read.

**Dashboard API**: The bot runs a lightweight HTTP server (`utils/dashboardApi.ts`) that the Next.js dashboard calls for live bot data (player state, guild info, bot process control). Authentication is validated by comparing the session token against a shared secret.

**Internationalisation**: All user-facing strings go through `utils/i18n.ts` using `t(locale, 'key', { vars })`. Locales are in `bot/src/locales/` (ru/en). Guild locale is read from `BotSettings.locale` in the DB.

**Guild data sync**: On startup and on channel/role/member events, `syncGuildData()` upserts the guild's channel list, role list, and member counts to the `Guild` table as JSON strings. The dashboard reads these for its UI pickers.

### Dashboard

**Auth**: NextAuth v4 with Discord OAuth2 provider (`lib/auth.ts`). Protected routes live under `app/dashboard/[guildId]/` and are gated by `middleware.ts`.

**Data flow**: Dashboard API routes (`app/api/`) either query the Prisma DB directly (settings reads/writes) or proxy requests to the bot's internal HTTP API (live player state, bot process control).

**State**: Zustand stores handle client-side UI state. Server components handle data fetching where possible.

**Per-guild routing**: All dashboard feature pages are nested under `app/dashboard/[guildId]/`. The `guildId` param is the Discord guild snowflake. Sidebar nav links always carry the current guildId.

### Database

Schema uses `db push` (no migration history). When modifying `schema.prisma`:
1. Edit `bot/prisma/schema.prisma`
2. `cd bot && npx prisma db push`
3. `npx prisma generate` (regenerates both `bot` and `dashboard` Prisma clients if they share the same schema)

JSON-as-string columns: `Guild.channels`, `Guild.roles`, `BotSettings.allowedTextChannels`, `BotSettings.adminRoles`, `MusicConfig.allowedChannels`, `MusicConfig.djRoles`, `UserVoiceSettings.blockedUsers`, `UserVoiceSettings.allowedUsers`. Parse them with `JSON.parse()` before use.

---

## Dashboard Design System

The dashboard uses a **dark-first design system** defined in `.codex/skills/overlord-dashboard-identity/references/overlord-style-reference.md`. Key rules:

**Color tokens** (defined as CSS variables in `dashboard/src/app/globals.css`):
- Primary action / active states: `--color-primary` (`#75f16a`, Overlord Green)
- Page background: `--bg-base` (`#060606`)
- Sidebar: `--surface-sidebar` (`#0b0b0b`)
- Cards/panels: `--surface-card` (`#111111`)
- Hover surfaces: `--surface-hover` (`#18181b`)
- Destructive: `--color-destructive` (`#f43f5e`)

**Tailwind aliases** to prefer: `bg-background`, `bg-surface`, `bg-surface-hover`, `bg-primary`, `text-foreground`, `text-secondary`, `text-danger`, `border-divider`. Use `bg-[var(--surface-sidebar)]` for aliases that don't exist.

**Typography**:
- `font-akony` — AKONY typeface for brand/display headings and section identity labels (uppercase, use sparingly in dense UI)
- `font-sans` — Futura Cyrillic for all UI text, controls, labels, body copy

**Reuse these shared components** before building new ones:
- `SectionBlock` — standard settings section wrapper (card surface, 24-32px radius, header/content split)
- `FloatingSaveBar` — dirty-state save/reset flow
- `SegmentedTabs` — feature tab controls with green active state
- Moderation primitives in `dashboard/src/components/moderation/ui.tsx` — role/channel pickers, searchable multi-selects

**Don't**: hardcode hex colors when a token exists; add a light theme; use Mercury's blue palette (`#5266eb`, `#cdddff`); use Arc Violet (`#8f5eff`) as a primary action color; make dense controls shift size on hover.

To work on dashboard UI with the full design system context, invoke the codex skill: `$overlord-dashboard-identity`.

---

## Key Conventions

- **Locale first**: any new bot response string must be added to both `ru` and `en` locale files and accessed through `t(locale, 'key')`.
- **Guild locale**: always fetch with `getGuildLocale(guildId)` rather than hardcoding a language.
- **Player custom IDs**: button `customId` values for the music player use `player_` prefix; search flow uses `search_` prefix. Ownership is enforced by embedding `userId` in the customId.
- **Schema changes**: always run `prisma db push` + `prisma generate` after editing `schema.prisma`. Do not introduce Prisma migrations — this project uses `db push`.
- **Prisma client**: import from `utils/database` (bot) or `lib/prisma` (dashboard), never instantiate a new `PrismaClient` directly.
- **Logging**: use the Winston logger from `utils/logger` in the bot; `console.log` is acceptable in dashboard server components and API routes.
- **No tests**: there is no test suite. Lint (`npm run lint`) is the only automated check.

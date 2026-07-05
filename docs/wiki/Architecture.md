# Architecture

## Process topology

Overlord runs as three cooperating processes:

```
┌────────────┐   Discord Gateway/REST   ┌─────────────┐
│  Discord   │◄────────────────────────►│     Bot     │
└────────────┘                          │ (Discord.js)│
                                        │  + bridge   │
┌────────────┐    HTTP (loopback)       │  API :3002  │
│ Dashboard  │◄────────────────────────►└──────┬──────┘
│ (Next.js)  │                                 │
│   :3001    │        WebSocket/REST     ┌─────┴──────┐
└─────┬──────┘◄───── (music state) ─────►│  Lavalink  │
      │                                  │   :2333    │
      │                                  └────────────┘
      ▼
┌─────────────────────────────┐
│ PostgreSQL                  │
│  ├─ main DB  (operational)  │
│  └─ stats DB (analytics)    │
└─────────────────────────────┘
```

| Process | Stack | Port | Role |
| --- | --- | --- | --- |
| **Bot** | Node.js, Discord.js v14, TypeScript | 3002 (bridge) | Gateway events, slash commands, component interactions, background services, the internal bridge API |
| **Dashboard** | Next.js App Router, React, Tailwind, NextUI | 3001 | Web UI, guild-scoped REST API routes, authentication |
| **Lavalink** | Java 17+, Lavalink v4 | 2333 | Audio streaming for the music module |

## Storage

Runtime storage is **PostgreSQL-only**, split into two databases with separate Prisma clients:

- **Main database** (`DATABASE_URL`) — guilds, settings, moderation cases, appeals, tickets, economy, music config, temp-voice, audit events. The schema of record is `bot/prisma/schema.prisma`; the dashboard copies it at generate time (`npm run generate`).
- **Stats database** (`STATS_PG_DATABASE_URL`) — raw analytics events (messages, voice sessions, member events, activities, interactions) plus aggregated read models (hourly/daily rollups, per-channel/per-member daily aggregates, precomputed top rankings). Schema: `dashboard/prisma/stats-postgres.schema.prisma`.

Splitting analytics from operational data keeps high-volume event writes from contending with the operational workload, and lets the stats database be sized and retained independently (stats data is rotated on a 2-year TTL).

## Bot ↔ dashboard bridge

The dashboard never talks to the Discord gateway itself. Anything that requires live Discord state or a privileged bot action goes through the bot's internal HTTP bridge (`bot/src/utils/dashboardApi.ts`, default `127.0.0.1:3002`):

- **Enrichment** — resolving user/channel IDs to display names, avatars, and channel metadata for stats and audit views.
- **Music control** — search, queue inspection, playback control from the dashboard player.
- **Ticket operations** — panel publishing/preview, close/claim/priority/transfer actions, notes.
- **Appeals** — review decisions, panel sync.
- **Economy money mutations** — grants, season endings. All balance changes route through the bot so the transaction ledger and audit log always fire; the dashboard never mutates balances directly.
- **Stats** — historical sync triggering.
- **System control** — health/status and shutdown.

The bridge binds to loopback and authenticates requests with a shared key (`DASHBOARD_API_KEY`); the key is mandatory in production.

## Bot internals

- **Handlers** — `bot/src/handlers/` auto-load slash commands (`bot/src/commands/**`) and gateway event listeners (`bot/src/events/**`) at startup.
- **Services** — `bot/src/services/` hold module logic (moderation, appeals, AI moderation, automod, tickets, economy, stats, retention). Long-running concerns are lifecycle services with `init()`/`stop()` — sweeps run on intervals (ticket auto-close, economy payouts/lotteries, moderation expirations, retention purges, stats buffer flushes) and stop gracefully on SIGINT/SIGTERM.
- **Interaction routing** — component interactions (buttons, selects, modals) are namespaced by custom-ID prefix and routed to the owning module's interaction service (for example `eco:*` → economy, ticket and appeal prefixes → their services).
- **Localization** — bot replies are localized per guild (`ru`/`en`) via `bot/src/utils/i18n.ts`; the economy module carries its own copy layer for card-style (Components v2) responses.

## Dashboard internals

- **Routes** — `dashboard/src/app/dashboard/[guildId]/**` for guild-scoped pages; `dashboard/src/app/api/**` for REST handlers. Roughly 65 API routes cover stats, moderation, tickets, economy, music, temp-voice, audit, and system views.
- **Guild access control** — every guild-scoped API route validates the caller's access to that guild before serving data (helpers such as `requireGuildStatsAccess`); a Discord OAuth token's guild list is checked against the requested guild.
- **UI system** — Tailwind-first with design tokens in `globals.css`, shared shells (`DashboardLayout`, `Sidebar`, `StatsNav`), NextUI for form primitives, Recharts for charts, Phosphor icons. Dark-first, localized `ru`/`en`.

## Authentication

Two session mechanisms coexist:

1. **Discord OAuth (NextAuth)** — the primary sign-in. Sessions are JWT-based; the token carries the Discord access token (with refresh) and the user's accessible guild list, which drives per-guild authorization on every API route.
2. **Local admin session** — an optional password login (`DASHBOARD_PASSWORD`) that mints a signed HMAC cookie. Intended for the instance operator; grants global access. Login attempts are rate-limited per IP.

Middleware protects all `/dashboard/**` routes and redirects unauthenticated users to `/login`.

## Repository layout

```
bot/            Discord bot (TypeScript, compiled with tsc)
dashboard/      Next.js dashboard
lavalink/       Lavalink server config (application.yml)
docs/           Specifications and this wiki
archives/       Isolated legacy artifacts (not part of runtime)
```

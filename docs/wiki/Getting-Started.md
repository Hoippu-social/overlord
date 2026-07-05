# Getting Started

## Prerequisites

- **Node.js 20+**
- **Java 17+** — required by Lavalink (music module)
- **PostgreSQL** — two databases: one for main operational data, one for statistics
- **A Discord application** with a bot user ([Discord Developer Portal](https://discord.com/developers/applications))

The bot requires the following privileged gateway intents to be enabled in the developer portal: **Server Members**, **Message Content**, and **Presence**.

## 1. Clone and install

```bash
git clone https://github.com/Hoippu-social/overlord.git
cd overlord

cd bot
npm install

cd ../dashboard
npm install
```

## 2. Create databases

Create two PostgreSQL databases, for example:

```sql
CREATE DATABASE discord_main;
CREATE DATABASE discord_stats;
```

## 3. Configure environment

Create `bot/.env` and `dashboard/.env`. Both must point at the same PostgreSQL databases:

```env
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/discord_main?schema=public
STATS_PG_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/discord_stats?schema=public
```

The bot↔dashboard bridge settings must match in both files:

```env
DASHBOARD_API_URL=http://127.0.0.1:3002
DASHBOARD_API_PORT=3002
DASHBOARD_API_KEY=<generate a long random string>
```

Bot-specific (`bot/.env`):

```env
DISCORD_TOKEN=<bot token>
CLIENT_ID=<application id>
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=<lavalink password>
```

Dashboard-specific (`dashboard/.env`):

```env
DISCORD_CLIENT_ID=<application id>
DISCORD_CLIENT_SECRET=<application client secret>
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=<generate a long random string>
DASHBOARD_PASSWORD=<optional local admin password>
```

See [Configuration](Configuration.md) for the full variable reference, including optional AI moderation and Spotify keys.

In the Discord developer portal, add the OAuth2 redirect URL: `<NEXTAUTH_URL>/api/auth/callback/discord`.

## 4. Push database schemas

```bash
cd dashboard
npm run main:pg:push     # main database schema
npm run stats:pg:push    # stats database schema
npm run db:postgres-only # sanity check: verifies PostgreSQL-only runtime

cd ../bot
npm run stats:pg:generate
```

## 5. Run

On Windows, the repository root has convenience launchers:

```bat
.\start_lavalink.bat
.\start_bot.bat
.\start_dashboard.bat
```

Or manually:

```bash
# Terminal 1 — Lavalink (music; optional if you don't need music)
cd lavalink && java -jar Lavalink.jar

# Terminal 2 — bot
cd bot && npm run dev

# Terminal 3 — dashboard
cd dashboard && npm run dev
```

- Dashboard: <http://localhost:3001>
- Bot bridge API: `127.0.0.1:3002` (internal, loopback-only by design)

The bot starts fine without Lavalink — music commands simply stay unavailable until the Lavalink node connects.

## 6. Verify

```bash
cd dashboard
npm test
npm run build

cd ../bot
npm test
npm run build
```

## First steps after setup

1. Invite the bot to your server with the `bot` and `applications.commands` scopes.
2. Open the dashboard, sign in with Discord, and pick your server.
3. Configure per-guild settings: locale (`ru`/`en`), timezone, moderation roles, audit routes.
4. Slash commands register globally on startup; global registration can take up to an hour to propagate on Discord's side.

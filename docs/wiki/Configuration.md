# Configuration

All configuration is environment-based. The bot reads `bot/.env`, the dashboard reads `dashboard/.env`. Never commit `.env` files or secrets.

## Shared (must match in both workspaces)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string for the main operational database |
| `STATS_PG_DATABASE_URL` | ✅ | PostgreSQL connection string for the stats database |
| `DASHBOARD_API_URL` | ✅ | URL of the bot bridge API as seen by the dashboard (default `http://127.0.0.1:3002`) |
| `DASHBOARD_API_PORT` | ✅ | Port the bot bridge API listens on (default `3002`) |
| `DASHBOARD_API_KEY` | production | Shared secret authenticating dashboard→bot bridge calls. Required in production (`NODE_ENV=production`) or when `DASHBOARD_API_REQUIRE_KEY=true` |

## Bot (`bot/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | Bot token |
| `CLIENT_ID` | ✅ | Discord application ID (used for slash-command registration) |
| `GUILD_ID` | — | If set, commands register to this guild only (instant propagation; useful in development) instead of globally |
| `LAVALINK_HOST` | music | Lavalink host (default `localhost`) |
| `LAVALINK_PORT` | music | Lavalink port (default `2333`) |
| `LAVALINK_PASSWORD` | music | Lavalink node password — must match `lavalink/application.yml` |
| `LAVALINK_SECURE` | — | Set to use TLS when connecting to a remote Lavalink node |
| `GEMINI_API_KEY` | AI mod | Google Gemini API key; used when a guild's AI moderation provider is `gemini` |
| `OPENAI_API_KEY` | AI mod | OpenAI API key; used when a guild's AI moderation provider is `openai` |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | — | Enables Spotify link resolution in the music module |
| `POSTGRES_BIN_DIR` | backups | Directory containing `pg_dump`/`pg_restore` for the built-in backup service |
| `DASHBOARD_URL` | — | Public dashboard URL used when the bot builds links (transcripts, dashboard deep links) |

## Dashboard (`dashboard/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | ✅ | Discord application ID (OAuth) |
| `DISCORD_CLIENT_SECRET` | ✅ | Discord application client secret (OAuth) |
| `NEXTAUTH_URL` | ✅ | Public URL of the dashboard (e.g. `http://localhost:3001` in development) |
| `NEXTAUTH_URL_INTERNAL` | — | Internal URL NextAuth uses server-side when the public URL isn't reachable from the host |
| `NEXTAUTH_SECRET` | ✅ | Secret for signing session JWTs and the local session cookie |
| `DASHBOARD_PASSWORD` | — | Enables the local password login for the instance operator |
| `DASHBOARD_INTERNAL_URL` | — | Internal self-URL for server-side fetches |
| `AUTH_COOKIE_DOMAIN` | — | Overrides the session cookie domain; set to `none` to force host-only cookies (relevant when `NEXTAUTH_URL` points at a production domain but you're testing on localhost) |
| `NEXT_PUBLIC_DASHBOARD_ORIGIN` | — | Public origin exposed to the client bundle |
| `NEXT_PUBLIC_SUPPORT_SERVER_URL` | — | Support server invite link shown in the UI |
| `BOT_API_URL` | — | Override for the bot bridge URL used by dashboard API routes (defaults to `http://127.0.0.1:3002`) |
| `BOT_PROCESS_MODE` / `BOT_START_SCRIPT` / `BOT_NODE_OPTIONS` | — | Used by the system control panel to manage the bot process |

## Cookie behavior

- In development (`NEXTAUTH_URL` on plain HTTP/localhost) cookies are host-only and non-secure.
- When `NEXTAUTH_URL` points at a production domain, session cookies are set `Secure` and may be scoped to a shared parent domain so the landing site and dashboard share a session. Use `AUTH_COOKIE_DOMAIN=none` to opt out.

## Per-guild settings (stored in the database, edited via dashboard)

These are not environment variables — each guild configures them in the dashboard:

- **Locale** — `ru` or `en`; affects bot replies and defaults for the dashboard UI.
- **Timezone** — used for all stats bucketing and date display.
- **Moderation** — moderator roles, per-command permission grants, automod rules and thresholds, AI moderation provider/model/category rules, appeal settings, retention policies.
- **Audit** — which event tags route to which log channels.
- **Tickets** — categories, forms, panel design, priorities, SLA policies, access profiles, notification rules.
- **Economy** — currency, earn sources and rates, multipliers, shop, quests, seasons.
- **Temp voice** — hub channel, naming template, user limits.
- **Music** — DJ roles and playback restrictions.

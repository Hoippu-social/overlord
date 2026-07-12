# Discord Bot Dashboard

## Setup
1. Ensure you have `Node.js` installed.
2. Run `start_dashboard.bat` to start the dashboard.

## Configuration
- The dashboard connects to the same PostgreSQL main database as the bot through `DATABASE_URL`.
- Stats reads use `STATS_PG_DATABASE_URL`; runtime storage is PostgreSQL-only.
- You need to set `DISCORD_CLIENT_SECRET` in `dashboard/.env`.

## Features
- Login with Discord
- View Guilds (Work in Progress)

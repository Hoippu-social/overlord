# Stats PostgreSQL Migration Runbook

## Scope
- Current source of truth: `SQLite` stats DB at `bot/prisma/stats.db`
- Future target: `PostgreSQL` stats workload via `STATS_PG_DATABASE_URL`
- This runbook prepares migration without switching production reads/writes

## Commands
- Generate dedicated PostgreSQL Prisma client:
  - `npm run stats:pg:generate` in `dashboard`
- Validate target readiness:
  - `npm run stats:pg:doctor` in `dashboard`
- Push schema into PostgreSQL:
  - `npm run stats:pg:push` in `dashboard`
- Create source manifest from current SQLite stats DB:
  - `npm run stats:pg:prepare` in `dashboard`
- Backfill workload tables into PostgreSQL:
  - `npm run stats:pg:backfill` in `dashboard`
- Compare SQLite vs PostgreSQL parity:
  - `npm run stats:pg:parity` in `dashboard`

## Environment
- Source SQLite:
  - `STATS_DATABASE_URL=file:D:/discord_bot/Dev/bot/prisma/stats.db`
- Target PostgreSQL:
  - `STATS_PG_DATABASE_URL=postgresql://user:password@host:5432/dbname?schema=public`
- Optional tuning:
  - `STATS_PG_BACKFILL_CHUNK_SIZE=500`

## Current workload covered
- `Guild`
- `AuditLogEvent`
- `MessageEvent`
- `InviteSnapshot`
- `InviteUseEvent`
- all `Stat*` source/read/control tables
- `GuildTimezoneHistory`
- `StatsAggregationState`
- `StatsJob`

## Safe sequence
1. Create a fresh backup/snapshot of `stats.db`.
2. Set `STATS_PG_DATABASE_URL`.
3. Run `npm run stats:pg:generate`.
4. Run `npm run stats:pg:doctor` and confirm the target is reachable.
5. Run `npm run stats:pg:push`.
6. Run `npm run stats:pg:prepare` and keep the manifest.
7. Run `npm run stats:pg:backfill`.
8. Run `npm run stats:pg:parity`.
9. Only after parity passes, start implementing dual-write and shadow reads.

## Guarantees and limits
- Backfill is restart-safe at row level because rows are inserted with preserved primary keys and `skipDuplicates`.
- Read models are copied as-is in this phase; semantic rebuild still stays a separate step.
- Sequence values in PostgreSQL are reset after each integer-ID table import.
- No production cutover happens in this phase.

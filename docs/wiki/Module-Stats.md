# Statistics

Server analytics with a dedicated PostgreSQL database, timezone-aware bucketing, and a multi-page dashboard.

## What is tracked

- **Messages** — per message: guild, channel, author, timestamp (no message content is stored in stats).
- **Voice** — sessions with join/leave times and per-channel duration.
- **Members** — join/leave events and periodic member-count snapshots (every 15 minutes).
- **Activities** — game/application presence sessions.
- **Interactions** — slash-command usage.

## Write path

The bot writes raw events to the stats database immediately. Aggregated counters (hourly/daily messages, voice seconds, member deltas) accumulate in an in-memory buffer flushed every 5 minutes. A rollup service maintains read models on a schedule:

- **Member snapshots** — every 15 minutes.
- **Top rankings** — precomputed per period (24H/3D/7D/14D/30D hourly; 90D/180D/ALL daily) for channels and members, in both message and voice categories.
- **Daily maintenance** — long-period rollups, database backup, and rotation of raw events older than 2 years.

Aggregates are bucketed in the **guild's configured timezone**, so daily boundaries match the community's local midnight. Timezone changes are recorded historically so past buckets remain correct.

## Dashboard pages

Under **Stats** in the dashboard, with a shared period picker (24h → 365d):

| Page | Contents |
| --- | --- |
| **Overview** | Total messages, voice time, member change; combined activity chart |
| **Messages** | Volume chart with weekly median, hour×weekday heatmap, top channels/members, unique counts |
| **Voice** | Voice time chart, average session length, peak hour, heatmap, top channels/speakers |
| **Members** | Growth curve, joins vs leaves, net change with trend percentages |
| **Channels** | Channel leaderboard with per-channel drilldown (overview/messages/voice tabs) |
| **Users** | Member leaderboard with per-user drilldown, including their moderation/audit trail |
| **Activities** | Most-played games with time distribution |
| **Contacts** | Interaction graph between members (2D/3D force graph) |

### Export

Overview, Messages, Voice, Members, and Activities support one-click export of the current period via the header download button: **JSON** (raw data), **CSV**, or **PNG** (rendered chart).

## Historical sync

Discord's API allows reading message history, so the dashboard can backfill message statistics for up to **90 days** into the past (Stats → sync button). Progress streams live to the browser. Voice activity and game presence cannot be backfilled — Discord does not retain them.

## Data hygiene

- No message content is stored in the stats database — only metadata (IDs, timestamps).
- Raw events are rotated after 2 years; aggregates remain.
- API access is guild-scoped: users only see stats for guilds they can access.

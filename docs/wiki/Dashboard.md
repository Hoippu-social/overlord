# Dashboard

The dashboard is a Next.js application (default port 3001) providing a guild-scoped control surface for every bot module. It is dark-first, responsive, and localized in Russian and English.

## Signing in

- **Discord OAuth** — the standard path. You see only guilds you have access to; every API request re-validates guild access.
- **Local admin password** — optional operator login (`DASHBOARD_PASSWORD`) with instance-wide access.

## Sections

After choosing a guild:

| Section | Purpose |
| --- | --- |
| **Overview** | Guild KPIs and quick status |
| **Stats** | Eight analytics pages with period picker, drilldowns, and file export — see [Stats](Module-Stats.md) |
| **Moderation** | Cases, automod, AI moderation, appeals, access control, retention, analytics — see [Moderation](Module-Moderation.md) |
| **Tickets** | Six-panel support workspace — see [Tickets](Module-Tickets.md) |
| **Economy** | Nine-tab economy workspace — see [Economy](Module-Economy.md) |
| **Music** | Live remote control for the player — see [Music](Module-Music.md) |
| **Temp Voice** | Hub and room configuration — see [Temp Voice](Module-TempVoice.md) |
| **Audit** | Event browser and route configuration — see [Audit](Module-Audit.md) |
| **Commands** | Per-command permission management |
| **Server Settings** | Locale, timezone, and general guild settings |
| **System** | Instance health: process status, resource usage, bot control (operator only) |

A global search (guild switcher + cross-section navigation) is available from the top bar.

## Design system

- Tailwind CSS with a token system defined in `globals.css` (dark surfaces, green primary `--color-primary-1`, violet secondary `--color-primary-2`).
- Display typography uses the AKONY face; body text uses Futura Cyrillic.
- NextUI for form primitives, Recharts for charts, Phosphor for icons.
- Localization defaults to Russian with a runtime `ru`/`en` switch; every surface carries both string sets.

## Public pages

- **Landing** (`/`) — product presentation.
- **Transcript viewer** (`/transcripts/[id]`) — closed-ticket transcripts, gated by unguessable per-ticket tokens.

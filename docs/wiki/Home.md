# Overlord Wiki

Overlord is a self-hostable Discord operations platform: a Discord.js bot paired with a Next.js dashboard. It brings moderation, analytics, support tickets, a guild economy, music, temporary voice channels, and audit logging into a single guild-scoped control surface.

> Source code is licensed under **AGPL-3.0-or-later**. Brand assets (the Overlord name, logos, and marketing materials) are separately protected — see [Licensing](Licensing-and-Contributing.md) before deploying a public fork.

## Getting around

| Page | What it covers |
| --- | --- |
| [Getting Started](Getting-Started.md) | Prerequisites, installation, environment setup, first run |
| [Architecture](Architecture.md) | Processes, databases, the bot↔dashboard bridge, authentication |
| [Configuration](Configuration.md) | Every environment variable and what it controls |
| [Commands](Commands.md) | Full slash-command reference |
| [Dashboard](Dashboard.md) | Dashboard sections and what each one does |
| [Licensing & Contributing](Licensing-and-Contributing.md) | AGPL terms, brand-asset rules, commercial licensing, how to contribute |

## Modules

| Module | Page |
| --- | --- |
| Moderation (manual, automod, AI, appeals) | [Moderation](Module-Moderation.md) |
| Server statistics & analytics | [Stats](Module-Stats.md) |
| Support tickets | [Tickets](Module-Tickets.md) |
| Guild economy & games | [Economy](Module-Economy.md) |
| Music playback | [Music](Module-Music.md) |
| Temporary voice channels | [Temp Voice](Module-TempVoice.md) |
| Audit log & invite tracking | [Audit](Module-Audit.md) |

## At a glance

- **Bot** — Discord.js v14, TypeScript, slash commands + component interactions, background lifecycle services.
- **Dashboard** — Next.js (App Router), React, Tailwind CSS, NextUI, Recharts; dark-first UI with Russian and English localization.
- **Storage** — PostgreSQL only, split into a main operational database and a dedicated stats database, both managed with Prisma.
- **Music** — Lavalink v4 via `lavalink-client`.
- **AI moderation** — optional, pluggable between Google Gemini and OpenAI-compatible APIs.

# Tickets

A support-ticket system where conversations happen in Discord (private threads) and configuration, triage, and analytics live in the dashboard.

## How tickets work

1. **Panels** — each ticket category designates a text channel; a configurable panel message (embed + button, designed in the dashboard) is published there.
2. A member clicks the panel button, optionally picks a department/item, and fills a **custom intake form** (modal with per-category questions).
3. A **private thread** is created in the panel channel; the member and the category's support roles are added.
4. Staff work the ticket with `/ticket` subcommands or from the dashboard: **claim/unclaim**, **hold/resume**, **add/remove users**, **rename**, **priority**, **transfer** between categories (with an approval flow).
5. On **close**, behavior is configurable per category — delete the thread or archive it. A full **HTML transcript** is generated on close.
6. The member can leave a **rating** after closure (feeds support analytics, and can grant an economy bonus).

Anti-spam: per-member open-ticket limits and a blacklist (`/ticket blacklist`).

## Transcripts

Closed tickets produce an HTML transcript viewable through the dashboard at a tokenized URL — access requires knowing the unguessable per-ticket token, not just an ID. Transcripts are listed in the dashboard's Transcripts tab.

## Dashboard workspace

The Tickets section is a six-panel workspace:

| Panel | Purpose |
| --- | --- |
| **Overview** | KPIs, activity chart, quick links |
| **Inbox** | Live ticket list with quick filters; detail drawer with actions, internal notes, and event timeline |
| **Categories** | Full category editor: intake form questions, department items, panel embed/button design with live Discord-style preview, close behavior |
| **Priorities** | Priority levels with colors and SLA targets |
| **Notifications** | Notification rules (channels/roles per event type) |
| **Access** | Access profiles mapping roles to ticket permissions |

Panel publishing and all live ticket actions route through the bot bridge, so Discord state and the database always stay consistent.

## Lifecycle automation

A background service sweeps periodically for:

- scheduled auto-close of inactive tickets,
- retention purges of old closed tickets according to policy.

## Related models

Tickets, categories, form questions, items, events (timeline), priorities, access profiles, routing rules, transfer requests, notification rules, internal notes, macros, tags, SLA policies, and business hours are all first-class database entities — the schema is designed for SaaS-grade support workflows.

# Audit Log & Invite Tracking

Structured audit logging of everything that happens in the guild, with per-tag routing to Discord channels and a searchable dashboard view.

## Event coverage

The bot listens to the full gateway surface and records structured audit events for:

- **Messages** — edits, deletions, bulk deletions (with content previews)
- **Members** — joins, leaves, role changes, nickname changes, boosts
- **Moderation** — every case action (warn/mute/timeout/kick/ban and reversals), automod triggers, AI moderation incidents, appeal decisions
- **Channels & roles** — create/update/delete
- **Voice** — joins, leaves, moves
- **Invites** — creation, deletion, and attributed uses
- **Economy** — significant money events
- **Bot/security** — configuration changes, system events

Each event carries a **tag** (module), severity, actor, target, and a structured payload.

## Routing

**Tag routes** map event tags to Discord channels — e.g. moderation events to `#mod-log`, message events to `#message-log`, voice to `#voice-log`. Configure via `/auditconfig` in Discord or the dashboard's Audit section. Events post as color-coded embeds (each tag has its own color).

## Invite tracking

The bot snapshots guild invites and diffs uses on each join, attributing every join to the invite (and inviter) that brought them. Attribution feeds:

- audit log entries for joins,
- the economy's invite-reward source (with maturation delay to resist fake-invite farming).

## Dashboard

The Audit section provides a filterable event browser (by tag, actor, target, time range) plus a message-event view. User-level audit trails also appear in the stats **Users** drilldown.

## Storage

Audit events are stored in the main database (`AuditLogEvent`); message events used for analytics live in the stats database. Retention of moderation-adjacent artifacts follows the guild's [retention policies](Module-Moderation.md#retention).

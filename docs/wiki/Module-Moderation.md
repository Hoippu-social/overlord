# Moderation

The moderation module has four layers that share one case system: manual commands, rule-based automod, AI-assisted moderation, and an appeals pipeline.

## Cases

Every sanction — manual or automatic — creates a **moderation case** with a per-guild sequential number. A case records the action, target, moderator (or automated origin), reason, duration, and evidence. Cases support:

- **Moderator notes** — private annotations attached to a case or user.
- **Appeals** — a case can be appealed once; the appeal links back to the case.
- **Dashboard browsing** — full case history with filtering in the dashboard's moderation section, plus per-user timelines in the stats user drilldown.
- **Economy integration** — configurable fines can be applied automatically when a case is created (see [Economy](Module-Economy.md)).

## Access control

Two mechanisms determine who can moderate:

1. **Role bindings** — guild roles mapped to moderation power levels.
2. **Per-command grants** — individual commands can be granted to specific roles, overriding the default binding.

Both are configured in the dashboard (Moderation → Access Control).

## Automod

Rule-based automatic moderation evaluated on every message. Built-in rule families include:

- **Flood** — too many messages in a time window
- **Duplicates** — repeated identical messages
- **Mentions** — mass-mention limit
- **Lines** — excessively tall messages
- **Emoji spam** — emoji count in a window
- **Zalgo** — combining-character abuse
- **Custom rules** — admin-defined pattern rules

Rules accumulate **strike weights**; sanction steps (warn → timeout → kick → ban, configurable) trigger at weight thresholds. All automod actions create cases and route to the audit log.

## AI moderation

Optional LLM-assisted analysis of messages, pluggable per guild between **Google Gemini** and **OpenAI-compatible** APIs (the instance operator supplies API keys; each guild picks its provider and model in the dashboard).

Messages are assessed against a fixed category taxonomy — toxicity, harassment, hate/discrimination, threats/violence, sexually explicit content, scam/fraud, self-harm crisis, doxxing/personal data — each with a per-guild rule: alert threshold, auto-action threshold, and action type.

When a threshold trips, the bot posts an **incident card** to the configured alert channel with action buttons (confirm sanction, dismiss, escalate). Confirmed incidents create moderation cases; repeated identical alerts are cooldown-suppressed. Incidents are browsable in the dashboard with their full assessment payloads.

## Appeals

A structured appeal pipeline for sanctioned members:

1. A member appeals via `/appeal` or the appeal panel (button + modal intake) published in a configured channel.
2. Each appeal becomes an **appeal ticket** — a private thread where staff can discuss with the appellant, with a full event timeline.
3. Staff decide: **accept**, **reject**, or **pardon** (reverses the sanction). Decisions can also be made from the dashboard, which routes through the bot bridge so Discord-side state stays consistent.
4. Configurable cooldowns and limits prevent appeal spam.

## Retention

Per-guild data retention policies clean up moderation byproducts on a schedule. Six categories are managed independently, each with a strategy (`KEEP` / `TRIM` / `DELETE`) and TTL:

| Category | Default |
| --- | --- |
| Dismissed AI incidents | delete after 30 days |
| Confirmed AI incidents | trim after 90 days |
| Automod case metadata | trim after 30 days |
| Appeal messages | keep (trim at 180 days if enabled) |
| Appeal resolution notes | keep (trim at 180 days if enabled) |
| Cleared-case metadata | keep (trim at 90 days if enabled) |

Configured in the dashboard (Moderation → Retention); a background service applies policies periodically.

## Dashboard

The moderation section has seven tabs: **Overview** (KPIs and recent activity), **Cases**, **Automod**, **AI Moderation**, **Appeals**, **Access Control**, **Retention**, plus **Analytics** with per-moderator drilldowns.

## Audit integration

Every moderation action emits a structured audit event with a severity and tag, routed to the guild's configured log channels — see [Audit](Module-Audit.md).

# Tickets Module — Technical Specification

**Date:** 2026-06-10
**Status:** Approved for implementation
**Scope:** Complete the support-ticket module end-to-end: database, bot (Discord side), bot↔dashboard bridge API, dashboard API routes, dashboard UI.

---

## Table of contents

1. [Overview & current state](#1-overview--current-state)
2. [Product decisions](#2-product-decisions)
3. [Feature set (v1 / v2)](#3-feature-set-v1--v2)
4. [Database schema](#4-database-schema)
5. [Bot architecture](#5-bot-architecture)
6. [Slash commands](#6-slash-commands)
7. [API design](#7-api-design)
8. [Dashboard frontend](#8-dashboard-frontend)
9. [Transcript design](#9-transcript-design)
10. [Localization](#10-localization)
11. [Implementation phases](#11-implementation-phases)
12. [Risks & open questions](#12-risks--open-questions)

---

## 1. Overview & current state

The module is roughly half-built: the **configuration layer exists**, the **runtime layer does not**.

### Already implemented

| Area | What exists | Where |
|---|---|---|
| Dashboard config UI | Tickets overview page (stats cards, activity chart, category list), full category editor (forms, items, button style, embed message builder), `CategoryModal` | `dashboard/src/app/dashboard/[guildId]/tickets/page.tsx`, `.../tickets/[categoryId]/page.tsx`, `dashboard/src/components/tickets/CategoryModal.tsx` |
| Dashboard API | CRUD for config/categories/forms/items, stats aggregation, appeal-category integration | `dashboard/src/app/api/guilds/[guildId]/tickets/route.ts`, `.../tickets/[categoryId]/route.ts` |
| Transcript viewer | Public page rendering `Ticket.transcript` HTML | `dashboard/src/app/transcripts/[ticketId]/page.tsx` |
| Reference implementation | Appeal system: panel sync, custom-id routing, modal intake, lifecycle service, event timeline | `bot/src/services/AppealService.ts`, `bot/src/services/AppealInteractionService.ts`, `bot/src/events/appealInteractions.ts` |

### Missing (this spec)

- **All bot-side runtime**: panel publishing, button/select/modal handlers, ticket creation, lifecycle (close/claim/hold/reopen), transcript generation, log-channel posting, rating flow, limits/anti-spam.
- **Dashboard live pages**: tickets list, ticket detail with actions, transcripts page (currently a "Coming Soon" stub at `.../tickets/transcripts/page.tsx`), stats page (stub at `.../tickets/stats/page.tsx`).

### ⚠️ Critical blocker: the DB layer is broken (Phase 0)

1. Ticket tables were created in `bot/prisma/migrations/20260208135408_add_tickets_module/migration.sql` (and `transcript` added in `20260208140212_add_transcript_field`), **but migration `bot/prisma/migrations/20260303233355_add_stat_interaction/migration.sql` DROPPED all five ticket tables** (`Ticket`, `TicketCategory`, `TicketConfig`, `TicketFormQuestion`, `TicketItem`, lines 12–42). The current `bot/prisma/schema.prisma` contains **no ticket models at all** (only `AppealTicket`).
2. The dashboard API routes access `prisma.ticketConfig` / `prisma.ticketCategory` / `prisma.ticket` through `// @ts-expect-error` comments — they only work if the live PostgreSQL schema still physically contains the tables.
3. The two routes disagree on the category message shape: `tickets/route.ts` POST writes a `messagePayload` column (lines 21, 101, 236) while `tickets/[categoryId]/route.ts` PUT writes `messageText` + `messageEmbeds` (lines 131–132, matching the original migration). One of these silently fails against any given DB.

**Phase 0 is mandatory before any feature work**: restore the ticket models into `schema.prisma` (extended per §4), create a clean migration, standardize on `messageText` + `messageEmbeds` (the shape the category editor UI uses), fix the POST route, and remove every `@ts-expect-error` / `as any` in the four affected files. Before writing the migration, inspect the live database state — tables may physically exist despite the drop migration (see §12, risk 1).

---

## 2. Product decisions

These were confirmed with the product owner and are **not** open for re-litigation during implementation:

1. **Tickets are private threads**, not channels. Each category designates one text channel; the configurable panel embed (built in the dashboard category editor) is posted there, and ticket threads are created in that same channel.
2. **Close behavior is configurable per category**:
   - `DELETE` — thread is deleted immediately on close;
   - `ARCHIVE` — thread is locked + archived (hidden from sidebar, read-only), with an optional auto-delete timer (`autoDeleteHours`): never delete, or delete N hours after close.
3. **Transcripts are always generated on close** (regardless of close action), stored in the DB, and accessible through the dashboard for a configurable retention period (`transcriptRetentionDays`). After retention expires, the transcript HTML is purged but ticket metadata (number, author, rating, timestamps) is kept.
4. **Transcript URLs use a random token** (`/transcripts/<token>`), not the enumerable integer id. The current `/transcripts/[ticketId]` route is an IDOR and must be replaced.
5. **v1 scope = full MVP** (see §3).
6. Existing dashboard config work (CategoryModal, category editor, embed builder) is kept and extended, not rewritten.

---

## 3. Feature set (v1 / v2)

### v1 (MVP — this spec's deliverable)

| Feature | Notes |
|---|---|
| Panel publish/sync to Discord | Per category; edit-or-create by stored message id; resync on bot `ready` |
| Intake flow | Panel button → (optional) department select from `TicketItem` → (optional) modal from `TicketFormQuestion` (max 5 inputs, Discord limit) |
| Thread creation | Private thread in the panel channel, sequential per-guild ticket number, name template |
| Limits & anti-spam | `maxOpenPerUser`, creation cooldown, per-guild blacklist |
| Lifecycle | Close (user if `allowUserClose`, staff always; staff close with reason modal), claim/unclaim, hold/resume, reopen |
| Transcripts | HTML, generated on every close, random access token, retention sweep |
| Rating | 1–5 buttons DM'd to author after close when `enableRating` |
| Logging | Embed to `TicketConfig.logChannelId`; per-category channel when `splitLogs` |
| Agent handling | `mentionAgents` role pings (pulls members into the private thread), `agentRoles` at category and item level, `requiredRoles` gating on items |
| Quick-reply items | `TicketItem.type === 'REPLY'` posts `replyContent` into the new thread |
| `/ticket` slash command group | §6 |
| Dashboard | Live tickets list, ticket detail with actions, transcripts page, publish button, new config fields |
| i18n | All user-facing bot strings in ru + en via `t()` |

### v2 (designed for, not built now — schema columns reserved where cheap)

- Auto-close on inactivity (`lastActivityAt` is already tracked in v1; v2 adds the sweep + warning message).
- Staff notes per ticket (add a `NOTE` `TicketEvent`).
- Priority field + sorting.
- Attachment archiving to disk (v1 stores Discord CDN links, which expire — see §9).
- Reply-from-dashboard (bridge relays staff messages into the thread).
- Deep stats page: agent leaderboard (closures by `closedBy`), avg first-response time, ratings per agent.
- SLA timers / working-hours notice.

### Explicitly cut

- Channel-based tickets (threads chosen).
- Multiple panels per category.

---

## 4. Database schema

All models go into `bot/prisma/schema.prisma` and are stored in PostgreSQL through the shared bot/dashboard Prisma schema. Conventions follow the rest of the schema: Discord ids as `String`, autoincrement `Int` PKs, JSON-as-string columns, guild scoping.

```prisma
model TicketConfig {
  id                      Int      @id @default(autoincrement())
  guildId                 String   @unique
  guild                   Guild    @relation(fields: [guildId], references: [id])
  enabled                 Boolean  @default(true)
  logChannelId            String?
  maxOpenPerUser          Int      @default(1)
  cooldownSeconds         Int      @default(60)
  transcriptRetentionDays Int      @default(90)   // 0 = keep forever
  nextTicketNumber        Int      @default(1)    // per-guild sequential counter
  blacklist               String?  // JSON: [{ userId, reason, addedBy, addedAt }]
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}

model TicketCategory {
  id             Int      @id @default(autoincrement())
  guildId        String
  name           String
  channelId      String?  // text channel: panel lives here, threads are created here
  panelMessageId String?  // synced panel message (null = not published)
  nameTemplate   String   @default("ticket-{number}") // also: {user}
  closeAction    String   @default("ARCHIVE")         // 'ARCHIVE' | 'DELETE'
  autoDeleteHours Int?    // ARCHIVE only: delete thread N hours after close; null = never
  saveHistory    Boolean  @default(false)  // kept for back-compat; transcript is now always generated (§9)
  mentionAgents  Boolean  @default(true)
  allowUserClose Boolean  @default(true)
  splitLogs      Boolean  @default(false)
  enableRating   Boolean  @default(false)
  agentRoles     String?  // JSON: string[] of role ids
  messageText    String?
  messageEmbeds  String?  // JSON: embed objects (canonical shape — see Phase 0)
  buttonText     String   @default("Create Ticket")
  buttonEmoji    String?
  buttonStyle    String   @default("PRIMARY")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  forms          TicketFormQuestion[]
  items          TicketItem[]
  tickets        Ticket[]

  @@index([guildId])
}

model TicketItem {
  id            Int            @id @default(autoincrement())
  categoryId    Int
  category      TicketCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  type          String         // 'DEPARTMENT' | 'REPLY'
  label         String
  description   String?
  emoji         String?
  replyContent  String?        // REPLY: posted into the thread after creation
  agentRoles    String?        // JSON string[], merged with category agentRoles
  requiredRoles String?        // JSON string[]; member must have at least one to pick this item
}

model TicketFormQuestion {
  id          Int            @id @default(autoincrement())
  categoryId  Int
  category    TicketCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  label       String
  type        String         // TEXT | PARAGRAPH | NUMBER | SELECT (SELECT rendered as TEXT in modal, v1)
  required    Boolean        @default(true)
  placeholder String?
  order       Int            @default(0)
}

model Ticket {
  id              Int            @id @default(autoincrement())
  guildId         String
  guild           Guild          @relation(fields: [guildId], references: [id])
  number          Int            // per-guild sequential, allocated in a transaction
  threadId        String         @unique  // (was channelId in the old migration)
  categoryId      Int
  category        TicketCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  itemId          Int?           // chosen DEPARTMENT item, if any
  authorId        String
  claimedBy       String?
  status          String         @default("OPEN") // OPEN | ON_HOLD | CLOSED
  formAnswers     String?        // JSON: [{ label, answer }]
  participants    String?        // JSON: string[] of userIds added via add-user
  closedBy        String?
  closeReason     String?        // free text, or system: 'CHANNEL_DELETED', 'AUTO_DELETED'
  lastActivityAt  DateTime       @default(now())
  transcript      String?        // self-contained HTML fragment; null after retention purge
  transcriptToken String?        @unique // 24+ chars URL-safe random; set on close
  deleteAfterAt   DateTime?      // ARCHIVE + autoDeleteHours: when the sweep deletes the thread
  rating          Int?           // 1..5
  createdAt       DateTime       @default(now())
  closedAt        DateTime?

  @@unique([guildId, number])
  @@index([guildId, status, createdAt])
  @@index([guildId, authorId, status])
}

model TicketEvent {
  id          Int      @id @default(autoincrement())
  guildId     String
  ticketId    Int
  eventType   String   // CREATED | CLAIMED | UNCLAIMED | ON_HOLD | RESUMED | CLOSED | REOPENED
                       // | USER_ADDED | USER_REMOVED | RENAMED | RATED | NOTE
  actorUserId String?
  note        String?
  payload     String?  // JSON, event-specific extras
  createdAt   DateTime @default(now())

  @@index([ticketId, createdAt])
  @@index([guildId, createdAt])
}
```

Also add the back-relations on `Guild`: `ticketConfig TicketConfig?`, `tickets Ticket[]`.

### Migration notes

- One migration, e.g. `add_tickets_module_v2`.
- Because `20260303233355_add_stat_interaction` dropped the tables but **may not have been applied to every live database**, the live PostgreSQL database can be in one of two states. Check first with `prisma db pull` into a scratch schema. If old ticket tables physically exist with data worth keeping, write the migration SQL by hand: rename old tables, create new ones, copy compatible columns (`channelId` -> `threadId`), backfill `number` from `id` ordering per guild. If they don't exist (expected case), a normal Prisma migration is fine.
- `nextTicketNumber` allocation must happen inside `prisma.$transaction` (read config row → increment → create ticket). PostgreSQL transaction semantics and the row update keep the per-guild counter race-safe.
- Regenerate the Prisma client in **both** workspaces (`bot` and `dashboard`) — the dashboard imports its own generated client.

---

## 5. Bot architecture

Follow the Appeal system patterns throughout: `AppealInteractionService.ts` for panel sync + custom-id routing + modal intake; `AppealService.ts` for an interaction-free lifecycle service with an event timeline, log posting, and DM handling.

### 5.1 File layout

| File (new) | Responsibility |
|---|---|
| `bot/src/services/TicketService.ts` | Lifecycle core: `createTicket`, `closeTicket`, `reopenTicket`, `setOnHold`, `resume`, `claimTicket`, `unclaimTicket`, `addUser`, `removeUser`, `renameTicket`, `submitRating`, `appendTicketEvent`, `checkCreateAllowed` (enabled/blacklist/limit/cooldown), log-channel posting, rating DM. **No Discord interaction objects in signatures** — takes `{ client, guild, actorId, ... }` like `AppealService`, so the same functions serve slash commands, buttons, and the dashboard bridge. |
| `bot/src/services/TicketPanelService.ts` | `syncTicketPanel(client, guildId, categoryId)` and `syncAllTicketPanels(client, guildId?)`. Edit-or-create keyed on `TicketCategory.panelMessageId` (mirror `syncDedicatedAppealPanel` in `AppealInteractionService.ts:208`). Builds the panel embed from `messageText`/`messageEmbeds` + the open button. Resync all enabled guilds on the `ready` event. |
| `bot/src/services/TicketInteractionService.ts` | `isTicketInteraction(interaction)` (customId prefix check) + `handleTicketInteraction(interaction, client)`. Routes all `tk_*` custom-ids, builds the department select and the intake modal from `TicketFormQuestion`, builds in-thread control buttons. |
| `bot/src/services/TicketTranscriptService.ts` | `generateTranscript(thread): Promise<string>` — fetch-on-close HTML export (§9). |
| `bot/src/services/TicketLifecycleService.ts` | Periodic sweep (`setInterval`, ~15 min, started from `ready`): (a) delete archived threads whose `deleteAfterAt` has passed → set `closeReason` stays, append event, clear `deleteAfterAt`; (b) purge `transcript` where `closedAt < now − transcriptRetentionDays` and retention > 0. |
| `bot/src/events/ticketInteractions.ts` | Thin event handler, clone of `bot/src/events/appealInteractions.ts`: `if (!isTicketInteraction(i)) return; await handleTicketInteraction(i, client);`. Auto-loaded by the existing event handler. |
| `bot/src/commands/tickets/ticket.ts` | Slash command group (§6). |

| File (modified) | Change |
|---|---|
| `bot/src/events/threadDelete.ts` (create if absent) | If a `Ticket` row matches the deleted thread and status ≠ CLOSED → mark CLOSED with `closeReason: 'CHANNEL_DELETED'`, no transcript, append event, post log. |
| `bot/src/events/messageCreate.ts` | If the message's channel is a thread and its id is in the open-ticket cache → bump `Ticket.lastActivityAt` (debounced, e.g. at most once per minute per ticket). Maintain an in-memory `Set<threadId>` refreshed on create/close/startup. |
| `bot/src/events/ready.ts` (or equivalent startup) | Call `syncAllTicketPanels` and start `TicketLifecycleService`. |
| `bot/src/utils/dashboardApi.ts` | New bridge endpoints (§7.1). |
| `bot/src/utils/i18n.ts` | `tickets.*` keys, ru + en (§10). |

### 5.2 Custom-id scheme

Prefix `tk`. Only numeric ids are embedded — never user input. All ids stay well under Discord's 100-char limit.

```
tk_open:<categoryId>                  panel button
tk_dept:<categoryId>                  ephemeral department select (option values = TicketItem.id)
tk_modal:<categoryId>:<itemId|0>      intake modal (inputs: tk_q_<questionId>)
tk_close:<ticketId>                   in-thread close button
tk_close_confirm:<ticketId>           user confirm button (ephemeral)
tk_close_reason:<ticketId>            staff close-reason modal (input: tk_close_note)
tk_claim:<ticketId>                   claim/unclaim toggle
tk_hold:<ticketId>                    hold/resume toggle
tk_reopen:<ticketId>                  button on the close-log message
tk_rate:<ticketId>:<1..5>             DM rating buttons
```

### 5.3 Creation flow

```
User clicks tk_open:<cat>
 ├─ TicketService.checkCreateAllowed(guildId, userId, categoryId):
 │    config.enabled? · user not blacklisted? · count of OPEN/ON_HOLD tickets by
 │    authorId < maxOpenPerUser? · newest ticket createdAt older than cooldownSeconds?
 │    → on failure: localized ephemeral error, stop.
 ├─ category has DEPARTMENT items?
 │    yes → ephemeral reply with tk_dept select; options filtered by requiredRoles
 │          against member.roles (hide items the member can't pick; if all hidden →
 │          localized "no access" error). On select, continue with itemId.
 ├─ category has form questions?
 │    yes → interaction.showModal(tk_modal:<cat>:<itemId|0>) — must be the FIRST
 │          response to the component interaction (checks above are fast DB reads,
 │          well within the 3s window; do NOT defer before showModal).
 │          Modal: first 5 questions by `order`; PARAGRAPH → TextInputStyle.Paragraph,
 │          everything else Short; required/placeholder from the row.
 │    no  → skip straight to creation.
 └─ On modal submit (or directly): deferReply({ ephemeral: true }), then
    TicketService.createTicket({ client, guild, authorId, categoryId, itemId, formAnswers }):
      1. $transaction: read+increment TicketConfig.nextTicketNumber; create Ticket row
         with threadId '' placeholder, status OPEN, formAnswers JSON.
      2. Resolve panel channel (category.channelId). channel.threads.create({
           name: renderTemplate(nameTemplate, { number, user: author.username }),
           type: ChannelType.PrivateThread,
           autoArchiveDuration: 10080,        // 7 days (Discord max)
           invitable: false,
         })
      3. thread.members.add(authorId); bot is added implicitly by sending the root message.
      4. Update Ticket.threadId; append TicketEvent CREATED.
      5. Root message in the thread:
         - content line: (mentionAgents ? merged agentRoles pings : '') + <@authorId>
           (role mentions pull role members into the private thread — this is the
           agent-access mechanism for private threads);
         - embed: ticket header (number, category, author, item label) + formAnswers
           as fields (truncate answers to 1024 chars);
         - row of buttons: [tk_close] (always rendered; permission enforced on click),
           [tk_claim], [tk_hold].
      6. If item?.type === 'REPLY' && replyContent → send replyContent as a second message.
      7. Post "Ticket #N opened" embed to the log channel (logChannelId; if
         splitLogs, per-category route — reuse the AuditTagRoute pattern or simply
         category-level log channel; v1: logChannelId only, splitLogs groups embeds
         by category color/tag).
      8. editReply: localized "Ticket created: <#threadId>".

Failure path: any Discord error after step 1 (missing perms, deleted channel) →
delete the Ticket row (or mark CLOSED, closeReason 'CREATE_FAILED'), editReply a
localized error, log a WARN via the existing audit helper (tag 'tickets').
```

**Bot permission requirements** (document in README / setup checks): `ViewChannel`, `SendMessages`, `CreatePrivateThreads`, `SendMessagesInThreads`, `ManageThreads`, `ManageMessages`, `EmbedLinks` in the panel channel.

### 5.4 Close / reopen flow

```
tk_close (button) or /ticket close
 ├─ permission: author && category.allowUserClose, OR staff
 │    staff = member has any category/item agentRole, OR ManageThreads, OR Administrator
 ├─ staff → showModal tk_close_reason (one optional Paragraph input)
 │  author → ephemeral confirm with [tk_close_confirm]
 └─ TicketService.closeTicket({ client, guild, ticketId, actorId, reason }):
      1. $transaction guard: re-read row; if status === CLOSED → throw AlreadyClosed
         (caller replies localized "already closed" ephemeral). Double-click safe.
      2. transcript = TicketTranscriptService.generateTranscript(thread)  — ALWAYS.
         transcriptToken = crypto.randomBytes(18).toString('base64url').
      3. Update: status CLOSED, closedAt, closedBy, closeReason, transcript,
         transcriptToken, deleteAfterAt = (closeAction === 'ARCHIVE' && autoDeleteHours)
         ? now + autoDeleteHours : null. Append TicketEvent CLOSED.
      4. Log embed to log channel: number, category, author, closer, reason, duration,
         transcript link `${DASHBOARD_URL}/transcripts/${transcriptToken}`,
         [tk_reopen] button.
      5. enableRating → DM the author: embed + tk_rate:<id>:<1..5> buttons
         (try/catch — DMs may be closed; append RATED event on click, one rating only).
      6. Thread teardown by closeAction:
         DELETE  → thread.delete()
         ARCHIVE → final "ticket closed" message in thread, then
                   thread.setLocked(true); thread.setArchived(true)

tk_reopen (log message button) or dashboard action
 └─ TicketService.reopenTicket:
      guard status === CLOSED; if closeAction was ARCHIVE and the thread still exists →
      setArchived(false), setLocked(false), re-add author; else (DELETE, or thread gone) →
      create a NEW private thread (same flow as creation steps 2–5, reusing the row:
      update threadId). status OPEN, clear closedAt/closedBy/deleteAfterAt,
      keep transcript/token (will be overwritten on next close). TicketEvent REOPENED.
```

### 5.5 Other lifecycle actions

- **claim/unclaim** — set/clear `claimedBy`; edit the root-message embed to show the claimer; only agents can claim; only the claimer or an admin can unclaim. Events CLAIMED/UNCLAIMED.
- **hold/resume** — toggle status OPEN ↔ ON_HOLD; post a localized notice in the thread; ON_HOLD tickets still count toward `maxOpenPerUser`. Events ON_HOLD/RESUMED.
- **add-user/remove-user** — `thread.members.add/remove`; maintain `participants` JSON. Events USER_ADDED/USER_REMOVED.
- **Discord auto-archive of an open ticket** (7-day inactivity): on `threadUpdate` where `archived` flips true for a thread whose ticket is OPEN/ON_HOLD and `closedAt` is null → unarchive it once; if it happens again within 24 h, leave it archived and set status ON_HOLD (prevents an unarchive war). Handle in a small `bot/src/events/threadUpdate.ts`.

### 5.6 Edge cases

| Case | Handling |
|---|---|
| Double-click on `tk_open` | In-memory `Set<'guildId:userId'>` lock around `createTicket`; `maxOpenPerUser` count is the backstop. |
| Thread deleted manually | `threadDelete` hook (§5.1) → CLOSED, `closeReason 'CHANNEL_DELETED'`, no transcript, log post. |
| Panel channel deleted / missing perms | try/catch around thread ops → localized ephemeral error + audit WARN; panel sync marks category unpublished (`panelMessageId = null`). |
| Stale panel (message deleted, category deleted/disabled) | `tk_open` for unknown/disabled category → localized "panel outdated" ephemeral; `ready`-event resync repairs panels. |
| Agent roles deleted | Filter ids through `guild.roles.cache.has()` before mentioning. |
| >5 form questions | Bot takes the first 5 by `order`; dashboard editor blocks saving more than 5 (§8). |
| Rating clicked twice / late | Guard `rating === null` and ticket CLOSED; disable buttons by editing the DM after first click. |

---

## 6. Slash commands

One command group, `bot/src/commands/tickets/ticket.ts`, registered like the moderation commands and gated through the existing `accessGroup`/`accessKey` mechanism honored in `bot/src/events/interactionCreate.ts`. All replies localized.

| Subcommand | Options | Access | Notes |
|---|---|---|---|
| `/ticket close` | `reason?: string` | author (if `allowUserClose`) or staff | Only inside a ticket thread (lookup by `threadId`) |
| `/ticket claim` | — | agents | |
| `/ticket unclaim` | — | claimer or admin | |
| `/ticket hold` / `/ticket resume` | — | agents | |
| `/ticket add-user` | `user: User` | agents | |
| `/ticket remove-user` | `user: User` | agents | Cannot remove the author |
| `/ticket rename` | `name: string` | agents | `thread.setName`, event RENAMED |
| `/ticket transcript` | — | agents | Generate without closing; ephemeral reply with dashboard link (mints `transcriptToken` if absent) |
| `/ticket blacklist add` | `user: User`, `reason?: string` | admin | |
| `/ticket blacklist remove` | `user: User` | admin | |
| `/ticket blacklist list` | — | admin | |
| `/ticket panel sync` | `category?` (autocomplete by name) | admin | Force re-publish; same code path as the dashboard publish button |

"Staff/agents" = member has any of the category's (or item's) `agentRoles`, or `ManageThreads`, or `Administrator` (see §12, Q4).

---

## 7. API design

### 7.1 Bot bridge (`bot/src/utils/dashboardApi.ts`)

Add three handlers next to the existing `/api/appeals/*` handlers (same `x-dashboard-key` + 127.0.0.1 guard, same JSON body parsing):

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/api/tickets/sync-panel` | POST | `{ guildId, categoryId? }` (omit categoryId = all) | `{ ok: true, results: [{ categoryId, state: 'created'\|'updated'\|'cleared'\|'error', error? }] }` |
| `/api/tickets/close` | POST | `{ guildId, ticketId, actorId, reason? }` | `{ ok: true, ticket: TicketDto }` or `{ ok: false, error }` |
| `/api/tickets/action` | POST | `{ guildId, ticketId, actorId, action: 'claim'\|'unclaim'\|'hold'\|'resume'\|'reopen' }` | `{ ok: true, ticket: TicketDto }` |

All three are thin wrappers around `TicketService` / `TicketPanelService` — no logic in the bridge.

### 7.2 Dashboard API routes (Next.js)

All under `dashboard/src/app/api/guilds/[guildId]/tickets/`, using the same session + guild-access checks as the existing tickets routes. `live: true` routes proxy to the bridge with `actorId` = session user's Discord id.

| Route | Method | Purpose | Shape |
|---|---|---|---|
| `tickets/route.ts` (exists) | GET/POST/PUT | **Fix**: POST switches `messagePayload` → `messageText`/`messageEmbeds`; PUT config gains `maxOpenPerUser`, `cooldownSeconds`, `transcriptRetentionDays`; remove `@ts-expect-error` | — |
| `tickets/[categoryId]/route.ts` (exists) | GET/PUT/DELETE | PUT gains `closeAction`, `autoDeleteHours`, `nameTemplate`; validate ≤ 5 form questions server-side; remove `@ts-expect-error` | — |
| `tickets/[categoryId]/publish/route.ts` (new) | POST | Publish/resync the panel | proxies `/api/tickets/sync-panel`; returns bridge result |
| `tickets/list/route.ts` (new) | GET | Live tickets table | query: `status?, categoryId?, authorId?, page=1, pageSize=25` → `{ tickets: [{ id, number, threadId, categoryId, categoryName, authorId, claimedBy, status, rating, createdAt, closedAt, lastActivityAt }], total }`. Direct Prisma; user names enriched client-side via the existing `/api/guilds/[guildId]/enrich`. |
| `tickets/items/[ticketId]/route.ts` (new) | GET | Ticket detail | row + parsed `formAnswers`/`participants` + `TicketEvent[]` timeline + `transcriptToken` |
| `tickets/items/[ticketId]/action/route.ts` (new) | POST | `{ action: 'close'\|'reopen'\|'claim'\|'unclaim'\|'hold'\|'resume', reason? }` | proxies bridge `/api/tickets/close` or `/action` |
| `tickets/transcripts/route.ts` (new) | GET | Closed tickets with non-null transcript, paged | `{ items: [{ id, number, categoryName, authorId, closedBy, closedAt, rating, transcriptToken }], total }` |

### 7.3 Public transcript route

Replace `dashboard/src/app/transcripts/[ticketId]/page.tsx` with `transcripts/[token]/page.tsx`: lookup `prisma.ticket.findUnique({ where: { transcriptToken: token } })`; 404 if not found or `transcript` is null (purged by retention). Remove the `@ts-ignore`/`as any` casts while there. Keep the page publicly accessible (the token is the secret — convenient to paste into Discord), but never render or link the numeric id.

---

## 8. Dashboard frontend

Reuse the existing NextUI patterns from `tickets/page.tsx` (Cards, Chips, Tremor charts) and the enrich-based user chips used on the moderation pages.

| Page | Status | Work |
|---|---|---|
| `tickets/page.tsx` | extend | "Publish panel" button per category card (calls publish route; show created/updated/error toast); published state badge (`panelMessageId != null`); config inputs for `maxOpenPerUser`, `cooldownSeconds`, `transcriptRetentionDays`. |
| `tickets/[categoryId]/page.tsx` | extend | New settings: `closeAction` (Archive/Delete radio), `autoDeleteHours` (visible when Archive; 0/empty = never), `nameTemplate` with `{number}`/`{user}` hint; client-side validation: max 5 form questions; panel publish status + publish button here too. |
| `tickets/live/page.tsx` | **new** | Tickets table: filters (status tabs Open/On hold/Closed, category select), columns: №, author (enriched chip), claimer, category, status chip, age/`lastActivityAt`, rating. Row click → detail page. Pagination via `tickets/list`. |
| `tickets/live/[ticketId]/page.tsx` | **new** | Detail: header (№, status, category, author, claimer), form answers block, participants, `TicketEvent` timeline (vertical list like moderation case view), action buttons (Close with reason modal, Claim/Unclaim, Hold/Resume, Reopen) wired to the action route, transcript link when closed. |
| `tickets/transcripts/page.tsx` | replace stub | Table of closed tickets with transcripts: №, category, author, closed by/at, rating, "View" → `/transcripts/[token]` in a new tab. Note row state for purged transcripts (metadata kept, HTML gone). |
| `tickets/stats/page.tsx` | v1: remove/redirect | The overview page already renders global stats + activity chart. Redirect this route to the overview (or delete the nav link). The deep stats page is v2. |
| `transcripts/[token]/page.tsx` | replace | §7.3. |

---

## 9. Transcript design

**Strategy: fetch-on-close** (not live logging). Zero runtime cost while the ticket is open, no duplicate storage; the existing `MessageEvent` table already covers edit/delete auditing if ever needed.

`TicketTranscriptService.generateTranscript(thread)`:

1. Paginate `thread.messages.fetch({ limit: 100, before })` until exhausted, **cap 2 000 messages** (oldest-first in output; note truncation in the header if capped).
2. Produce a **self-contained HTML fragment** (no `<html>`/`<head>` wrapper — the viewer page injects it via `dangerouslySetInnerHTML` and provides the page chrome/styles). Use semantic markup with stable class names (`.tr-msg`, `.tr-author`, `.tr-time`, `.tr-content`, `.tr-attachment`, `.tr-embed`) that the viewer styles.
3. **Escape all user content** with a local `escapeHtml`; then apply a minimal markdown renderer (bold/italic/underline/strikethrough/inline code/code block/links) — no heavy dependency, ~50 lines.
4. Header block: ticket №, category, author tag+id, created/closed timestamps, closer, reason, participants.
5. Attachments: render as links; `<img>` inline for image content-types using the Discord CDN URL. **Discord CDN URLs are signed and expire** — v1 accepts link rot and labels attachments with a tooltip note ("link may expire"). v2: download images ≤ 8 MB to `bot/data/transcripts/<ticketId>/` and serve through a dashboard route.
6. Bot/system messages included; component rows skipped.

**Size & retention:** ~300–600 bytes HTML per message → worst case ≈ 1 MB per ticket in a TEXT column; acceptable for the current PostgreSQL deployment. The retention sweep in `TicketLifecycleService` nulls `transcript` (keeps `transcriptToken` and metadata) when `closedAt < now − transcriptRetentionDays` (skip when retention is 0 = forever). If DB growth becomes an issue, moving transcript bodies to object storage is the designated v2 escape hatch — keep all reads going through one accessor function to make that swap cheap.

---

## 10. Localization

All user-facing bot strings go through `t(locale, key, vars)` from `bot/src/utils/i18n.ts`, ru + en, under a `tickets.` namespace. Required key groups (final list during implementation):

- `tickets.panel.*` — default panel embed text when `messageText`/`messageEmbeds` are empty.
- `tickets.create.*` — created confirmation, errors: disabled, blacklisted, limitReached, cooldown (`{seconds}`), noAccess, createFailed, panelOutdated.
- `tickets.thread.*` — root embed labels (number/category/author/claimedBy), closed notice, hold/resume notices.
- `tickets.close.*` — confirm prompt, reason modal title/label, alreadyClosed, log embed labels, transcript link label.
- `tickets.rating.*` — DM prompt, thanks, alreadyRated.
- `tickets.cmd.*` — slash command replies and errors (notATicketThread, noPermission, userAdded/Removed, renamed, blacklist add/remove/list).

Guild locale comes from `BotSettings.locale` (default `ru`), same as existing modules.

---

## 11. Implementation phases

| Phase | Work | Depends on | Size |
|---|---|---|---|
| **0** | Restore + extend Prisma schema (§4), inspect live DB, migration, regenerate clients in both workspaces; fix `messagePayload` → `messageText`/`messageEmbeds` in `tickets/route.ts`; remove all `@ts-expect-error`/`as any` in the 4 tickets/transcripts files | — | S–M |
| **1** | `TicketPanelService` + `ready` resync + bridge `/api/tickets/sync-panel` + dashboard publish button/badge | 0 | M |
| **2** | Intake: `TicketInteractionService` (open/dept/modal), `TicketService.createTicket` + `checkCreateAllowed`, `events/ticketInteractions.ts`, i18n keys, in-memory locks | 1 | L |
| **3** | Lifecycle: close (confirm/reason/teardown by `closeAction`), claim/unclaim, hold/resume, reopen, `threadDelete`/`threadUpdate` hooks, log posting, `/ticket` command group | 2 | L |
| **4** | Transcripts: `TicketTranscriptService`, token, wire into close, `transcripts/[token]` viewer, dashboard transcripts page, `TicketLifecycleService` (auto-delete sweep + retention purge) | 3 | M |
| **5** | Rating DM flow; dashboard live list + detail pages; `tickets/list`, `items/[ticketId]` (+action), bridge `/api/tickets/close`+`/action` proxy routes | 3 | M |
| **6** | Polish: `/ticket blacklist`, stale-panel handling, category editor new fields + ≤5 validation, stats-page redirect, setup permission checks | 3–5 | S–M |

Phases 4 and 5 are parallelizable between a bot developer and a frontend developer. v2 backlog (not scheduled): inactivity auto-close, staff notes, priority, attachment archiving, reply-from-dashboard, deep stats.

### Acceptance criteria (v1 done =)

1. A category configured in the dashboard can be published; the panel appears/updates in Discord.
2. A member can open a ticket end-to-end (button → select → modal → private thread), respecting limits, cooldown, blacklist, and `requiredRoles`.
3. Agents get pulled in via role mention; claim/hold/close/reopen work from buttons, slash commands, and the dashboard, with consistent state.
4. Every close produces a transcript reachable at `/transcripts/<token>` and listed in the dashboard; numeric-id access is gone.
5. `closeAction` DELETE removes the thread; ARCHIVE locks+archives it and the sweep deletes it after `autoDeleteHours`; retention purge clears old transcript HTML.
6. Rating DM works and shows up in dashboard stats.
7. No `@ts-expect-error` remains in tickets/transcripts code; `tsc` passes in both workspaces.

---

## 12. Risks & open questions

1. **Live DB state after the drop migration (highest risk).** The `20260303233355` migration dropped the ticket tables, but the dashboard kept writing to them via `@ts-expect-error` — meaning some environments may have orphaned tables with real category configs. **Action: inspect every live PostgreSQL database before Phase 0 and decide keep-vs-recreate per environment.**
2. **Discord thread limits.** Active-thread cap is per guild (1 000 for most guilds) — far above realistic ticket volume, but ARCHIVE-without-auto-delete accumulates archived threads indefinitely; recommend defaulting `autoDeleteHours` to a sane value (e.g. 168 = 7 days) in the dashboard UI while keeping "never" available.
3. **Private thread availability.** Private threads are available to all guilds since Discord's 2022 rollout, but verify against the current `discord.js@14.21` typings during Phase 2; if a guild-tier restriction resurfaces, the fallback is public threads + a warning in the dashboard.
4. **Staff fallback when `agentRoles` is empty** — spec'd as `ManageThreads` or `Administrator` (§6). Revisit if the moderation team wants `ModerationRoleBinding` reuse instead.
5. **Auto-sync panels on category save?** Currently sync is explicit (publish button / `/ticket panel sync` / `ready`). Auto-syncing on every dashboard PUT adds a bridge call per save — nice-to-have, decide in Phase 6.
6. **Attachment link rot** is accepted for v1 (§9); revisit if support workflows depend on screenshots in old transcripts.


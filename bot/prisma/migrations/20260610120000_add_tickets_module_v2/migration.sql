-- Tickets Module v2
-- Uses IF NOT EXISTS guards because tables may physically exist in some environments
-- despite migration 20260303233355 having dropped them.

-- TicketConfig
CREATE TABLE IF NOT EXISTS "TicketConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "logChannelId" TEXT,
    "maxOpenPerUser" INTEGER NOT NULL DEFAULT 1,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "transcriptRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "nextTicketNumber" INTEGER NOT NULL DEFAULT 1,
    "blacklist" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- TicketCategory
CREATE TABLE IF NOT EXISTS "TicketCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
    "panelMessageId" TEXT,
    "nameTemplate" TEXT NOT NULL DEFAULT 'ticket-{number}',
    "closeAction" TEXT NOT NULL DEFAULT 'ARCHIVE',
    "autoDeleteHours" INTEGER,
    "saveHistory" BOOLEAN NOT NULL DEFAULT false,
    "mentionAgents" BOOLEAN NOT NULL DEFAULT true,
    "allowUserClose" BOOLEAN NOT NULL DEFAULT true,
    "splitLogs" BOOLEAN NOT NULL DEFAULT false,
    "enableRating" BOOLEAN NOT NULL DEFAULT false,
    "agentRoles" TEXT,
    "messageText" TEXT,
    "messageEmbeds" TEXT,
    "buttonText" TEXT NOT NULL DEFAULT 'Create Ticket',
    "buttonEmoji" TEXT,
    "buttonStyle" TEXT NOT NULL DEFAULT 'PRIMARY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketCategory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- TicketItem
CREATE TABLE IF NOT EXISTS "TicketItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "replyContent" TEXT,
    "agentRoles" TEXT,
    "requiredRoles" TEXT,
    CONSTRAINT "TicketItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- TicketFormQuestion
CREATE TABLE IF NOT EXISTS "TicketFormQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "placeholder" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TicketFormQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ticket
CREATE TABLE IF NOT EXISTS "Ticket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "threadId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "itemId" INTEGER,
    "authorId" TEXT NOT NULL,
    "claimedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "formAnswers" TEXT,
    "participants" TEXT,
    "closedBy" TEXT,
    "closeReason" TEXT,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transcript" TEXT,
    "transcriptToken" TEXT,
    "deleteAfterAt" DATETIME,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- TicketEvent
CREATE TABLE IF NOT EXISTS "TicketEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TicketConfig_guildId_key" ON "TicketConfig"("guildId");
CREATE INDEX IF NOT EXISTS "TicketCategory_guildId_idx" ON "TicketCategory"("guildId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_threadId_key" ON "Ticket"("threadId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_transcriptToken_key" ON "Ticket"("transcriptToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_guildId_number_key" ON "Ticket"("guildId", "number");
CREATE INDEX IF NOT EXISTS "Ticket_guildId_status_createdAt_idx" ON "Ticket"("guildId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Ticket_guildId_authorId_status_idx" ON "Ticket"("guildId", "authorId", "status");
CREATE INDEX IF NOT EXISTS "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "TicketEvent_guildId_createdAt_idx" ON "TicketEvent"("guildId", "createdAt");

-- NOTE: If TicketCategory already exists from a previous partial migration,
-- run these ALTER TABLE statements manually if the target database lacks IF NOT EXISTS support:
--   ALTER TABLE "TicketCategory" ADD COLUMN "panelMessageId" TEXT;
--   ALTER TABLE "TicketCategory" ADD COLUMN "nameTemplate" TEXT NOT NULL DEFAULT 'ticket-{number}';
--   ALTER TABLE "TicketCategory" ADD COLUMN "closeAction" TEXT NOT NULL DEFAULT 'ARCHIVE';
--   ALTER TABLE "TicketCategory" ADD COLUMN "autoDeleteHours" INTEGER;
-- For a clean dev environment, "prisma db push" handles this automatically.

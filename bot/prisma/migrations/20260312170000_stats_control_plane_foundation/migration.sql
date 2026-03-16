ALTER TABLE "StatMessage" ADD COLUMN "sourceMessageId" TEXT;
ALTER TABLE "StatVoiceState" ADD COLUMN "sessionKey" TEXT;
ALTER TABLE "StatActivity" ADD COLUMN "sessionKey" TEXT;
ALTER TABLE "StatInteraction" ADD COLUMN "interactionKey" TEXT;

CREATE UNIQUE INDEX "StatMessage_sourceMessageId_key" ON "StatMessage"("sourceMessageId");
CREATE UNIQUE INDEX "StatVoiceState_sessionKey_key" ON "StatVoiceState"("sessionKey");
CREATE UNIQUE INDEX "StatActivity_sessionKey_key" ON "StatActivity"("sessionKey");
CREATE UNIQUE INDEX "StatInteraction_interactionKey_key" ON "StatInteraction"("interactionKey");

CREATE TABLE "StatMemberEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventKey" TEXT,
    "source" TEXT NOT NULL DEFAULT 'live',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "StatMemberEvent_eventKey_key" ON "StatMemberEvent"("eventKey");
CREATE INDEX "StatMemberEvent_guildId_createdAt_idx" ON "StatMemberEvent"("guildId", "createdAt");
CREATE INDEX "StatMemberEvent_guildId_userId_createdAt_idx" ON "StatMemberEvent"("guildId", "userId", "createdAt");
CREATE INDEX "StatMemberEvent_guildId_eventType_createdAt_idx" ON "StatMemberEvent"("guildId", "eventType", "createdAt");

CREATE TABLE "StatMemberDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "StatMemberDaily_guildId_userId_date_key" ON "StatMemberDaily"("guildId", "userId", "date");
CREATE INDEX "StatMemberDaily_guildId_date_idx" ON "StatMemberDaily"("guildId", "date");
CREATE INDEX "StatMemberDaily_guildId_userId_date_idx" ON "StatMemberDaily"("guildId", "userId", "date");

CREATE TABLE "StatChannelDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "StatChannelDaily_guildId_channelId_date_key" ON "StatChannelDaily"("guildId", "channelId", "date");
CREATE INDEX "StatChannelDaily_guildId_date_idx" ON "StatChannelDaily"("guildId", "date");
CREATE INDEX "StatChannelDaily_guildId_channelId_date_idx" ON "StatChannelDaily"("guildId", "channelId", "date");

CREATE TABLE "GuildTimezoneHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GuildTimezoneHistory_guildId_effectiveFrom_idx" ON "GuildTimezoneHistory"("guildId", "effectiveFrom");

CREATE TABLE "StatsAggregationState" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceHighWatermark" TEXT,
    "rebuildRequired" BOOLEAN NOT NULL DEFAULT false,
    "jobStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "lastSuccessfulRebuildAt" DATETIME,
    "lastSourceEventAt" DATETIME,
    "lastReadModelSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "StatsJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "StatsJob_status_createdAt_idx" ON "StatsJob"("status", "createdAt");
CREATE INDEX "StatsJob_guildId_status_createdAt_idx" ON "StatsJob"("guildId", "status", "createdAt");

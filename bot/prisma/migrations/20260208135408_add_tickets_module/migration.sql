-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lastDaily" DATETIME,
    "lastWork" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT NOT NULL DEFAULT '!',
    "name" TEXT,
    "icon" TEXT,
    "channels" TEXT,
    "roles" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "memberCount" INTEGER,
    "onlineCount" INTEGER
);

-- CreateTable
CREATE TABLE "BotSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "prefixCommandsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "commandChannelMode" TEXT NOT NULL DEFAULT 'BLACKLIST',
    "allowedTextChannels" TEXT,
    "adminRoles" TEXT,
    "restoreRolesOnRejoin" BOOLEAN NOT NULL DEFAULT false,
    "restoreNicknameOnRejoin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MusicConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelMode" TEXT NOT NULL DEFAULT 'BLACKLIST',
    "allowedChannels" TEXT,
    "djMode" BOOLEAN NOT NULL DEFAULT false,
    "djRoles" TEXT,
    "defaultVolume" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MusicConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TempVoiceConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "hubChannelId" TEXT NOT NULL,
    "interfaceChannelId" TEXT,
    "categoryId" TEXT,
    "nameTemplate" TEXT NOT NULL DEFAULT 'Room {user}',
    "userLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TempVoiceConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TempVoiceRoom" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hubChannelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TempVoiceRoom_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "TempVoiceConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserVoiceSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredName" TEXT,
    "preferredLimit" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "blockedUsers" TEXT,
    "allowedUsers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserVoiceSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MusicNowPlaying" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "uri" TEXT,
    "artworkUrl" TEXT,
    "durationMs" INTEGER,
    "positionMs" INTEGER,
    "volume" INTEGER,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MusicNowPlaying_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "authorId" TEXT,
    "eventType" TEXT NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "contentBefore" TEXT,
    "contentAfter" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachmentsAfter" TEXT,
    "attachmentsBefore" TEXT
);

-- CreateTable
CREATE TABLE "AuditLogEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "channelId" TEXT,
    "messageId" TEXT,
    "payload" TEXT,
    "severity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditTagRoute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "template" TEXT,
    "mentions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InviteSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviterId" TEXT,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InviteUseEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "inviterId" TEXT,
    "code" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "stayDurationSec" INTEGER,
    "voiceDurationSec" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StatVoiceState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "duration" INTEGER
);

-- CreateTable
CREATE TABLE "StatMemberCount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "online" INTEGER NOT NULL DEFAULT 0,
    "idle" INTEGER NOT NULL DEFAULT 0,
    "dnd" INTEGER NOT NULL DEFAULT 0,
    "offline" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StatHourly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "dateHour" DATETIME NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
    "newMembers" INTEGER NOT NULL DEFAULT 0,
    "leftMembers" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "StatDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
    "newMembers" INTEGER NOT NULL DEFAULT 0,
    "leftMembers" INTEGER NOT NULL DEFAULT 0,
    "maxOnline" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "StatTopMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatTopChannel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "duration" INTEGER
);

-- CreateTable
CREATE TABLE "TicketConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "logChannelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelId" TEXT,
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

-- CreateTable
CREATE TABLE "TicketItem" (
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

-- CreateTable
CREATE TABLE "TicketFormQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "placeholder" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TicketFormQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "rating" INTEGER,
    CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BotSettings_guildId_key" ON "BotSettings"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicConfig_guildId_key" ON "MusicConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "TempVoiceConfig_guildId_key" ON "TempVoiceConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "TempVoiceRoom_channelId_key" ON "TempVoiceRoom"("channelId");

-- CreateIndex
CREATE INDEX "TempVoiceRoom_guildId_idx" ON "TempVoiceRoom"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVoiceSettings_guildId_userId_key" ON "UserVoiceSettings"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MusicNowPlaying_guildId_key" ON "MusicNowPlaying"("guildId");

-- CreateIndex
CREATE INDEX "MessageEvent_guildId_channelId_createdAt_idx" ON "MessageEvent"("guildId", "channelId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageEvent_guildId_authorId_createdAt_idx" ON "MessageEvent"("guildId", "authorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLogEvent_guildId_tag_createdAt_idx" ON "AuditLogEvent"("guildId", "tag", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditTagRoute_guildId_tag_key" ON "AuditTagRoute"("guildId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "InviteSnapshot_guildId_code_key" ON "InviteSnapshot"("guildId", "code");

-- CreateIndex
CREATE INDEX "InviteUseEvent_guildId_memberId_idx" ON "InviteUseEvent"("guildId", "memberId");

-- CreateIndex
CREATE INDEX "StatMessage_guildId_channelId_idx" ON "StatMessage"("guildId", "channelId");

-- CreateIndex
CREATE INDEX "StatMessage_guildId_authorId_idx" ON "StatMessage"("guildId", "authorId");

-- CreateIndex
CREATE INDEX "StatMessage_guildId_createdAt_idx" ON "StatMessage"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "StatVoiceState_guildId_channelId_idx" ON "StatVoiceState"("guildId", "channelId");

-- CreateIndex
CREATE INDEX "StatVoiceState_guildId_userId_idx" ON "StatVoiceState"("guildId", "userId");

-- CreateIndex
CREATE INDEX "StatVoiceState_guildId_joinedAt_idx" ON "StatVoiceState"("guildId", "joinedAt");

-- CreateIndex
CREATE INDEX "StatMemberCount_guildId_createdAt_idx" ON "StatMemberCount"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StatHourly_guildId_dateHour_key" ON "StatHourly"("guildId", "dateHour");

-- CreateIndex
CREATE UNIQUE INDEX "StatDaily_guildId_date_key" ON "StatDaily"("guildId", "date");

-- CreateIndex
CREATE INDEX "StatTopMember_guildId_period_category_value_idx" ON "StatTopMember"("guildId", "period", "category", "value" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StatTopMember_guildId_userId_period_category_key" ON "StatTopMember"("guildId", "userId", "period", "category");

-- CreateIndex
CREATE INDEX "StatTopChannel_guildId_period_category_value_idx" ON "StatTopChannel"("guildId", "period", "category", "value" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StatTopChannel_guildId_channelId_period_category_key" ON "StatTopChannel"("guildId", "channelId", "period", "category");

-- CreateIndex
CREATE INDEX "StatActivity_guildId_userId_idx" ON "StatActivity"("guildId", "userId");

-- CreateIndex
CREATE INDEX "StatActivity_guildId_name_idx" ON "StatActivity"("guildId", "name");

-- CreateIndex
CREATE INDEX "StatActivity_guildId_startTime_idx" ON "StatActivity"("guildId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "TicketConfig_guildId_key" ON "TicketConfig"("guildId");

-- CreateIndex
CREATE INDEX "TicketCategory_guildId_idx" ON "TicketCategory"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

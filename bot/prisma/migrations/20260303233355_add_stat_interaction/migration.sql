/*
  Warnings:

  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TicketCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TicketConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TicketFormQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TicketItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "Ticket_channelId_key";

-- DropIndex
DROP INDEX "TicketCategory_guildId_idx";

-- DropIndex
DROP INDEX "TicketConfig_guildId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Ticket";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TicketCategory";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TicketConfig";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TicketFormQuestion";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TicketItem";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "StatInteraction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
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
INSERT INTO "new_BotSettings" ("adminRoles", "allowedTextChannels", "commandChannelMode", "createdAt", "guildId", "id", "locale", "prefixCommandsEnabled", "restoreNicknameOnRejoin", "restoreRolesOnRejoin", "updatedAt") SELECT "adminRoles", "allowedTextChannels", "commandChannelMode", "createdAt", "guildId", "id", "locale", "prefixCommandsEnabled", "restoreNicknameOnRejoin", "restoreRolesOnRejoin", "updatedAt" FROM "BotSettings";
DROP TABLE "BotSettings";
ALTER TABLE "new_BotSettings" RENAME TO "BotSettings";
CREATE UNIQUE INDEX "BotSettings_guildId_key" ON "BotSettings"("guildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StatInteraction_guildId_createdAt_idx" ON "StatInteraction"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "StatInteraction_guildId_fromUserId_idx" ON "StatInteraction"("guildId", "fromUserId");

-- CreateIndex
CREATE INDEX "StatInteraction_guildId_toUserId_idx" ON "StatInteraction"("guildId", "toUserId");

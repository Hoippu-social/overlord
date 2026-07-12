-- Restore command-level moderation rule storage used by the dashboard and bot.
ALTER TABLE "ModerationConfig" ADD COLUMN "commandRules" TEXT;

ALTER TABLE "TicketPriority"
ADD COLUMN "firstResponseSeconds" INTEGER,
ADD COLUMN "resolutionSeconds" INTEGER;

UPDATE "TicketPriority"
SET
  "firstResponseSeconds" = "firstResponseMinutes" * 60,
  "resolutionSeconds" = "resolutionMinutes" * 60
WHERE "firstResponseSeconds" IS NULL
   OR "resolutionSeconds" IS NULL;

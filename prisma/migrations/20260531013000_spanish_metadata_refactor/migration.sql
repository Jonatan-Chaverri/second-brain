ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "topics" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "tools" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "events" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "media" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "observations" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "journal_entries"
SET
  "topics" = COALESCE("topics", '[]'::jsonb),
  "tools" = COALESCE("tools", '[]'::jsonb),
  "events" = COALESCE("events", '[]'::jsonb),
  "media" = COALESCE("media", '[]'::jsonb),
  "observations" = COALESCE("observations", '[]'::jsonb),
  "emotions" = COALESCE("emotions", '[]'::jsonb),
  "actionItems" = COALESCE("actionItems", '[]'::jsonb);

ALTER TABLE "journal_entries"
  ALTER COLUMN "emotions" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "emotions" SET NOT NULL,
  ALTER COLUMN "actionItems" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "actionItems" SET NOT NULL;

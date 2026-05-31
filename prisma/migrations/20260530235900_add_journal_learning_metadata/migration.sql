ALTER TABLE "journal_entries"
ADD COLUMN "lessons" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "ideas" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "experiences" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "workKnowledge" JSONB NOT NULL DEFAULT '[]'::jsonb;

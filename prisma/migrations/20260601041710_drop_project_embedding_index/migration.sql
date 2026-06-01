-- DropIndex
DROP INDEX "projects_embedding_idx";

-- AlterTable
ALTER TABLE "journal_entries" ALTER COLUMN "emotions" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "actionItems" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "lessons" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "ideas" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "experiences" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "workKnowledge" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "topics" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "tools" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "events" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "media" SET DEFAULT '[]'::jsonb,
ALTER COLUMN "observations" SET DEFAULT '[]'::jsonb;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "technologies" SET DEFAULT '[]'::jsonb;

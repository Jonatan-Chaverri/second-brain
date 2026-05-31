-- CreateEnum
CREATE TYPE "UserInsightCategory" AS ENUM ('insecurity', 'fear', 'achievement', 'strength', 'weakness', 'value', 'belief', 'goal', 'dream', 'preference', 'relationship_pattern', 'habit', 'other');

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

-- CreateTable
CREATE TABLE "user_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "category" "UserInsightCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_insights_userId_category_idx" ON "user_insights"("userId", "category");

-- CreateIndex
CREATE INDEX "user_insights_journalEntryId_idx" ON "user_insights"("journalEntryId");

-- AddForeignKey
ALTER TABLE "user_insights" ADD CONSTRAINT "user_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_insights" ADD CONSTRAINT "user_insights_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

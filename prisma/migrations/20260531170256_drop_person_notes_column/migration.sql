/*
  Warnings:

  - You are about to drop the column `notes` on the `people` table. All the data in the column will be lost.
  - You are about to drop the `journal_entry_topics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `topics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "journal_entry_topics" DROP CONSTRAINT "journal_entry_topics_journalEntryId_fkey";

-- DropForeignKey
ALTER TABLE "journal_entry_topics" DROP CONSTRAINT "journal_entry_topics_topicId_fkey";

-- DropForeignKey
ALTER TABLE "topics" DROP CONSTRAINT "topics_userId_fkey";

-- DropIndex
DROP INDEX "journal_entries_embedding_idx";

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
ALTER TABLE "people" DROP COLUMN "notes";

-- DropTable
DROP TABLE "journal_entry_topics";

-- DropTable
DROP TABLE "topics";

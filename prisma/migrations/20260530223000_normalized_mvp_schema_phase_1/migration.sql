CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "JournalEntry" RENAME TO "journal_entries";

ALTER INDEX "User_pkey" RENAME TO "users_pkey";
ALTER INDEX "User_email_key" RENAME TO "users_email_key";
ALTER INDEX "JournalEntry_pkey" RENAME TO "journal_entries_pkey";
ALTER INDEX "JournalEntry_entryDate_idx" RENAME TO "journal_entries_entryDate_idx";
ALTER INDEX "JournalEntry_userId_entryDate_key" RENAME TO "journal_entries_userId_entryDate_key";
ALTER TABLE "journal_entries"
  RENAME CONSTRAINT "JournalEntry_userId_fkey" TO "journal_entries_userId_fkey";

ALTER TABLE "journal_entries" RENAME COLUMN "topics" TO "legacyTopics";
ALTER TABLE "journal_entries" RENAME COLUMN "people" TO "legacyPeople";
ALTER TABLE "journal_entries" RENAME COLUMN "projects" TO "legacyProjects";

ALTER TABLE "journal_entries" ADD COLUMN "embedding_new" extensions.vector(1536);

UPDATE "journal_entries"
SET "embedding_new" = CASE
  WHEN "embedding" IS NULL OR cardinality("embedding") = 0 THEN NULL
  WHEN cardinality("embedding") = 1536 THEN
    ('[' || array_to_string("embedding", ',') || ']')::extensions.vector(1536)
  ELSE NULL
END;

ALTER TABLE "journal_entries" DROP COLUMN "embedding";
ALTER TABLE "journal_entries" RENAME COLUMN "embedding_new" TO "embedding";

CREATE INDEX "journal_entries_userId_idx" ON "journal_entries"("userId");
CREATE INDEX "journal_entries_embedding_idx"
  ON "journal_entries"
  USING hnsw ("embedding" extensions.vector_cosine_ops);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "people" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "topics" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journal_entry_projects" (
  "journalEntryId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,

  CONSTRAINT "journal_entry_projects_pkey" PRIMARY KEY ("journalEntryId", "projectId")
);

CREATE TABLE "journal_entry_people" (
  "journalEntryId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,

  CONSTRAINT "journal_entry_people_pkey" PRIMARY KEY ("journalEntryId", "personId")
);

CREATE TABLE "journal_entry_topics" (
  "journalEntryId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,

  CONSTRAINT "journal_entry_topics_pkey" PRIMARY KEY ("journalEntryId", "topicId")
);

CREATE UNIQUE INDEX "projects_userId_canonicalName_key"
  ON "projects"("userId", "canonicalName");
CREATE UNIQUE INDEX "people_userId_canonicalName_key"
  ON "people"("userId", "canonicalName");
CREATE UNIQUE INDEX "topics_userId_canonicalName_key"
  ON "topics"("userId", "canonicalName");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "people"
  ADD CONSTRAINT "people_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_projects"
  ADD CONSTRAINT "journal_entry_projects_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_projects"
  ADD CONSTRAINT "journal_entry_projects_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_people"
  ADD CONSTRAINT "journal_entry_people_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_people"
  ADD CONSTRAINT "journal_entry_people_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "people"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_topics"
  ADD CONSTRAINT "journal_entry_topics_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_topics"
  ADD CONSTRAINT "journal_entry_topics_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "topics"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

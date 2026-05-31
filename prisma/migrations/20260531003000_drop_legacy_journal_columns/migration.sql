ALTER TABLE "journal_entries"
  DROP COLUMN IF EXISTS "legacyProjects",
  DROP COLUMN IF EXISTS "legacyPeople",
  DROP COLUMN IF EXISTS "legacyTopics";

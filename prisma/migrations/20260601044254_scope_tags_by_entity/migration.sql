-- CreateEnum
CREATE TYPE "TagScope" AS ENUM ('person', 'project');

-- AlterTable: add scope column (default person so existing rows are person-scoped)
ALTER TABLE "tags" ADD COLUMN "scope" "TagScope" NOT NULL DEFAULT 'person';

-- Mark tags that are only used by projects as project-scoped
UPDATE "tags" t SET "scope" = 'project'
WHERE EXISTS (SELECT 1 FROM "project_tags" pt WHERE pt."tagId" = t."id")
  AND NOT EXISTS (SELECT 1 FROM "person_tags" pt2 WHERE pt2."tagId" = t."id");

-- For tags used by BOTH person and project: duplicate the row as a project-scoped tag
-- and re-point project_tags to the new id so each scope owns its own row.
WITH dual AS (
  SELECT t."id" AS old_id, t."userId", t."canonicalName", t."displayName"
  FROM "tags" t
  WHERE EXISTS (SELECT 1 FROM "project_tags" pt WHERE pt."tagId" = t."id")
    AND EXISTS (SELECT 1 FROM "person_tags" pt2 WHERE pt2."tagId" = t."id")
),
inserted AS (
  INSERT INTO "tags" ("id", "userId", "scope", "canonicalName", "displayName", "createdAt", "updatedAt")
  SELECT
    'c' || substr(md5(random()::text || clock_timestamp()::text || d.old_id), 1, 24),
    d."userId",
    'project'::"TagScope",
    d."canonicalName",
    d."displayName",
    NOW(),
    NOW()
  FROM dual d
  RETURNING "id", "userId", "canonicalName"
)
UPDATE "project_tags" pt
SET "tagId" = i."id"
FROM inserted i
WHERE pt."tagId" IN (SELECT old_id FROM dual d WHERE d."userId" = i."userId" AND d."canonicalName" = i."canonicalName");

-- Replace the old unique index with a scope-aware one
DROP INDEX "tags_userId_canonicalName_key";
CREATE UNIQUE INDEX "tags_userId_scope_canonicalName_key" ON "tags"("userId", "scope", "canonicalName");

CREATE TYPE "EntityAliasType" AS ENUM (
  'project',
  'person',
  'topic',
  'tool',
  'event',
  'media',
  'observation',
  'emotion'
);

CREATE TABLE "entity_aliases" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entityType" "EntityAliasType" NOT NULL,
  "alias" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "entity_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "entity_aliases_userId_entityType_alias_key"
  ON "entity_aliases"("userId", "entityType", "alias");

CREATE INDEX "entity_aliases_userId_idx"
  ON "entity_aliases"("userId");

CREATE INDEX "entity_aliases_entityType_idx"
  ON "entity_aliases"("entityType");

CREATE INDEX "entity_aliases_canonicalName_idx"
  ON "entity_aliases"("canonicalName");

ALTER TABLE "entity_aliases"
  ADD CONSTRAINT "entity_aliases_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

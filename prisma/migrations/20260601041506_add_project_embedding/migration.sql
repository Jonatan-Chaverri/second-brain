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

-- AlterTable: add embedding column to projects
ALTER TABLE "projects" ADD COLUMN "embedding" extensions.vector(1536),
ALTER COLUMN "technologies" SET DEFAULT '[]'::jsonb;

-- CreateIndex: hnsw cosine index for project embeddings
CREATE INDEX "projects_embedding_idx"
  ON "projects"
  USING hnsw ("embedding" extensions.vector_cosine_ops);

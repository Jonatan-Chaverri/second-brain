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
ALTER TABLE "projects" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "startDate" DATE,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "technologies" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "project_tags" (
    "projectId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("projectId","tagId")
);

-- CreateIndex
CREATE INDEX "project_tags_tagId_idx" ON "project_tags"("tagId");

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

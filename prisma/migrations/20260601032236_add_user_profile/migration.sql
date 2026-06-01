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
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" DATE,
    "profession" TEXT,
    "personalityType" TEXT,
    "country" TEXT,
    "city" TEXT,
    "languages" TEXT,
    "pronouns" TEXT,
    "bio" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

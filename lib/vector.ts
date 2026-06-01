import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

function ensureFiniteVector(values: number[]) {
  return values.every((value) => Number.isFinite(value));
}

export function formatVectorLiteral(values: number[]) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  if (!ensureFiniteVector(values)) {
    throw new Error("Embedding contains non-finite values.");
  }

  return `[${values.join(",")}]`;
}

export async function setJournalEntryEmbedding(
  journalEntryId: string,
  embedding: number[],
  client: DbClient = prisma
) {
  const vectorLiteral = formatVectorLiteral(embedding);

  if (!vectorLiteral) {
    await client.$executeRaw`
      UPDATE "journal_entries"
      SET "embedding" = NULL
      WHERE "id" = ${journalEntryId}
    `;
    return;
  }

  await client.$executeRaw`
    UPDATE "journal_entries"
    SET "embedding" = ${vectorLiteral}::extensions.vector(1536)
    WHERE "id" = ${journalEntryId}
  `;
}

export async function setProjectEmbedding(
  projectId: string,
  embedding: number[] | null,
  client: DbClient = prisma
) {
  const vectorLiteral = embedding ? formatVectorLiteral(embedding) : null;

  if (!vectorLiteral) {
    await client.$executeRaw`
      UPDATE "projects"
      SET "embedding" = NULL
      WHERE "id" = ${projectId}
    `;
    return;
  }

  await client.$executeRaw`
    UPDATE "projects"
    SET "embedding" = ${vectorLiteral}::extensions.vector(1536)
    WHERE "id" = ${projectId}
  `;
}

export async function setPersonEmbedding(
  personId: string,
  embedding: number[] | null,
  client: DbClient = prisma
) {
  const vectorLiteral = embedding ? formatVectorLiteral(embedding) : null;

  if (!vectorLiteral) {
    await client.$executeRaw`
      UPDATE "people"
      SET "embedding" = NULL
      WHERE "id" = ${personId}
    `;
    return;
  }

  await client.$executeRaw`
    UPDATE "people"
    SET "embedding" = ${vectorLiteral}::extensions.vector(1536)
    WHERE "id" = ${personId}
  `;
}

export async function getJournalEntryEmbeddingDimensions(
  journalEntryId: string,
  client: DbClient = prisma
) {
  const result = await client.$queryRaw<Array<{ dimensions: number | null }>>`
    SELECT vector_dims("embedding") AS "dimensions"
    FROM "journal_entries"
    WHERE "id" = ${journalEntryId}
    LIMIT 1
  `;

  return result[0]?.dimensions ?? null;
}

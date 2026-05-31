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

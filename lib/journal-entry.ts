import { Prisma } from "@prisma/client";

export type JournalArrays = {
  topics: string[];
  people: string[];
  projects: string[];
  emotions: string[];
  actionItems: string[];
};

export type SerializableJournalEntry = {
  id: string;
  rawText: string;
  summary: string | null;
  topics: string[];
  people: string[];
  projects: string[];
  emotions: string[];
  actionItems: string[];
  embeddingDimensions: number;
  entryDate: string;
  updatedAt: string;
};

function parseStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function serializeJournalEntry(entry: {
  id: string;
  rawText: string;
  summary: string | null;
  topics: Prisma.JsonValue | null;
  people: Prisma.JsonValue | null;
  projects: Prisma.JsonValue | null;
  emotions: Prisma.JsonValue | null;
  actionItems: Prisma.JsonValue | null;
  embedding: number[];
  entryDate: Date;
  updatedAt: Date;
}): SerializableJournalEntry {
  return {
    id: entry.id,
    rawText: entry.rawText,
    summary: entry.summary,
    topics: parseStringArray(entry.topics),
    people: parseStringArray(entry.people),
    projects: parseStringArray(entry.projects),
    emotions: parseStringArray(entry.emotions),
    actionItems: parseStringArray(entry.actionItems),
    embeddingDimensions: entry.embedding.length,
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    updatedAt: entry.updatedAt.toISOString()
  };
}

export function normalizeEntryDate(rawDate?: string) {
  return new Date(`${rawDate ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

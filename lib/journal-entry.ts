import { Prisma } from "@prisma/client";

export type JournalArrays = {
  topics: string[];
  tools: string[];
  events: string[];
  media: string[];
  observations: string[];
  emotions: string[];
  actionItems: string[];
  lessons: string[];
  ideas: string[];
  experiences: string[];
  workKnowledge: string[];
};

export type SerializableJournalEntry = {
  id: string;
  rawText: string;
  summary: string | null;
  projects: string[];
  people: string[];
  topics: string[];
  tools: string[];
  events: string[];
  media: string[];
  observations: string[];
  emotions: string[];
  actionItems: string[];
  lessons: string[];
  ideas: string[];
  experiences: string[];
  workKnowledge: string[];
  embeddingDimensions: number | null;
  entryDate: string;
  updatedAt: string;
};

export const journalEntryWithRelationsInclude = {
  entryProjects: {
    include: {
      project: {
        select: {
          canonicalName: true,
          displayName: true
        }
      }
    }
  },
  entryPeople: {
    include: {
      person: {
        select: {
          canonicalName: true,
          displayName: true
        }
      }
    }
  }
} satisfies Prisma.JournalEntryInclude;

type JournalEntryWithRelations = Prisma.JournalEntryGetPayload<{
  include: typeof journalEntryWithRelationsInclude;
}>;

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function sortStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function serializeJournalEntry(
  entry: JournalEntryWithRelations,
  options?: {
    embeddingDimensions?: number | null;
  }
): SerializableJournalEntry {
  return {
    id: entry.id,
    rawText: entry.rawText,
    summary: entry.summary,
    projects: sortStrings(entry.entryProjects.map((item) => item.project.displayName)),
    people: sortStrings(entry.entryPeople.map((item) => item.person.displayName)),
    topics: parseStringArray(entry.topics),
    tools: parseStringArray(entry.tools),
    events: parseStringArray(entry.events),
    media: parseStringArray(entry.media),
    observations: parseStringArray(entry.observations),
    emotions: parseStringArray(entry.emotions),
    actionItems: parseStringArray(entry.actionItems),
    lessons: parseStringArray(entry.lessons),
    ideas: parseStringArray(entry.ideas),
    experiences: parseStringArray(entry.experiences),
    workKnowledge: parseStringArray(entry.workKnowledge),
    embeddingDimensions: options?.embeddingDimensions ?? null,
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    updatedAt: entry.updatedAt.toISOString()
  };
}

export function normalizeEntryDate(rawDate?: string) {
  return new Date(`${rawDate ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

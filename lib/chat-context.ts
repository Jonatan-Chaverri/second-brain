import { EntityAliasType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateQueryEmbedding } from "@/lib/openai";
import { normalizeLookupKey } from "@/lib/entity-normalization";
import {
  findPersonCanonicalNamesByTagLabels,
  getPersonDirectoryForCanonicalNames,
  PersonDirectoryEntry
} from "@/lib/people-service";
import { formatVectorLiteral } from "@/lib/vector";

type SimilarJournalEntryRow = {
  id: string;
  similarity: number;
};

export type ChatContextBlock = {
  entryId: string;
  entryDate: string;
  summary: string | null;
  rawText: string;
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
  similarity: number;
};

const journalEntryChatInclude = {
  entryProjects: {
    include: {
      project: {
        select: {
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

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function sortStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export async function findRelevantJournalEntries(input: {
  userId: string;
  message: string;
  limit?: number;
}) {
  const queryEmbedding = await generateQueryEmbedding(input.message);
  const vectorLiteral = formatVectorLiteral(queryEmbedding);

  if (!vectorLiteral) {
    return [];
  }

  const rows = await prisma.$queryRaw<SimilarJournalEntryRow[]>`
    SELECT
      "id",
      1 - ("embedding" <=> ${vectorLiteral}::extensions.vector(1536)) AS "similarity"
    FROM "journal_entries"
    WHERE "userId" = ${input.userId}
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vectorLiteral}::extensions.vector(1536)
    LIMIT ${input.limit ?? 5}
  `;

  if (rows.length === 0) {
    return [];
  }

  const entries = await prisma.journalEntry.findMany({
    where: {
      id: {
        in: rows.map((row) => row.id)
      }
    },
    include: journalEntryChatInclude
  });

  const similarityById = new Map(rows.map((row) => [row.id, row.similarity]));
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  return rows
    .map((row) => {
      const entry = entryById.get(row.id);

      if (!entry) {
        return null;
      }

      return {
        entryId: entry.id,
        entryDate: entry.entryDate.toISOString().slice(0, 10),
        summary: entry.summary,
        rawText: entry.rawText,
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
        similarity: similarityById.get(entry.id) ?? 0
      } satisfies ChatContextBlock;
    })
    .filter((entry): entry is ChatContextBlock => entry !== null);
}

export async function buildChatContext(input: {
  userId: string;
  message: string;
  limit?: number;
  minSimilarity?: number;
}) {
  const minSimilarity = input.minSimilarity ?? 0.3;
  const all = await findRelevantJournalEntries(input);
  const entries = all.filter((entry) => entry.similarity >= minSimilarity);

  const referencedCanonicalNames = await getCanonicalNamesForEntries(
    entries.map((entry) => entry.entryId)
  );

  const messageMentionedCanonicalNames = await findPersonCanonicalNamesMentionedInMessage(
    input.userId,
    input.message
  );

  const tagMentionedCanonicalNames = await findPersonCanonicalNamesByTagMentions(
    input.userId,
    input.message
  );

  const allCanonicalNames = Array.from(
    new Set([
      ...referencedCanonicalNames,
      ...messageMentionedCanonicalNames,
      ...tagMentionedCanonicalNames
    ])
  );

  const peopleDirectory = await getPersonDirectoryForCanonicalNames(
    input.userId,
    allCanonicalNames
  );

  return {
    entries,
    peopleDirectory,
    hasEnoughContext: entries.length > 0 || peopleDirectory.length > 0
  };
}

async function findPersonCanonicalNamesByTagMentions(
  userId: string,
  message: string
): Promise<string[]> {
  const normalizedMessage = ` ${normalizeLookupKey(message)} `;

  if (normalizedMessage.trim().length === 0) {
    return [];
  }

  const tags = await prisma.tag.findMany({
    where: { userId },
    select: { canonicalName: true, displayName: true }
  });

  const matchedLabels: string[] = [];

  for (const tag of tags) {
    const needle = normalizeLookupKey(tag.displayName);
    if (needle && normalizedMessage.includes(` ${needle} `)) {
      matchedLabels.push(tag.displayName);
    }
  }

  if (matchedLabels.length === 0) {
    return [];
  }

  return findPersonCanonicalNamesByTagLabels(userId, matchedLabels);
}

async function findPersonCanonicalNamesMentionedInMessage(
  userId: string,
  message: string
): Promise<string[]> {
  const normalizedMessage = ` ${normalizeLookupKey(message)} `;

  if (normalizedMessage.trim().length === 0) {
    return [];
  }

  const [people, aliases] = await Promise.all([
    prisma.person.findMany({
      where: { userId },
      select: { canonicalName: true, displayName: true }
    }),
    prisma.entityAlias.findMany({
      where: { userId, entityType: EntityAliasType.person },
      select: { alias: true, canonicalName: true }
    })
  ]);

  const matches = new Set<string>();

  for (const person of people) {
    const needle = normalizeLookupKey(person.displayName);
    if (needle && normalizedMessage.includes(` ${needle} `)) {
      matches.add(person.canonicalName);
    }
  }

  for (const alias of aliases) {
    const needle = normalizeLookupKey(alias.alias);
    if (needle && normalizedMessage.includes(` ${needle} `)) {
      matches.add(alias.canonicalName);
    }
  }

  return Array.from(matches);
}

async function getCanonicalNamesForEntries(entryIds: string[]): Promise<string[]> {
  if (entryIds.length === 0) {
    return [];
  }

  const rows = await prisma.journalEntryPerson.findMany({
    where: { journalEntryId: { in: entryIds } },
    select: {
      person: {
        select: { canonicalName: true }
      }
    }
  });

  return Array.from(new Set(rows.map((row) => row.person.canonicalName)));
}

export type { PersonDirectoryEntry };

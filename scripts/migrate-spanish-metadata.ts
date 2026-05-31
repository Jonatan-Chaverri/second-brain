import { prisma } from "../lib/prisma.ts";
import {
  normalizeEntityList,
  normalizeMetadataList
} from "../lib/entity-normalization.ts";

type TopicRow = {
  journalEntryId: string;
  label: string;
};

type EntryRow = {
  id: string;
  userId: string;
  topics: unknown;
  tools: unknown;
  events: unknown;
  media: unknown;
  observations: unknown;
  emotions: unknown;
  actionItems: unknown;
};

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [trimmed];
    }
  }

  return [];
}

function classifyLegacyLabel(label: string) {
  const tools = normalizeMetadataList([label], "tool");
  const events = normalizeMetadataList([label], "event");
  const media = normalizeMetadataList([label], "media");
  const observations = normalizeMetadataList([label], "observation");
  const topics = normalizeMetadataList([label], "topic");

  if (tools.length > 0 || events.length > 0 || media.length > 0 || observations.length > 0) {
    return {
      projects: [] as string[],
      topics: [] as string[],
      tools,
      events,
      media,
      observations
    };
  }

  if (topics.length > 0) {
    return {
      projects: [] as string[],
      topics,
      tools: [] as string[],
      events: [] as string[],
      media: [] as string[],
      observations: [] as string[]
    };
  }

  return {
    projects: [label],
    topics: [] as string[],
    tools: [] as string[],
    events: [] as string[],
    media: [] as string[],
    observations: [] as string[]
  };
}

async function hasLegacyTopicTables() {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('topics', 'journal_entry_topics')
  `;

  return Number(result[0]?.count ?? 0) === 2;
}

async function readLegacyTopicRows() {
  return prisma.$queryRaw<TopicRow[]>`
    SELECT
      jet."journalEntryId" AS "journalEntryId",
      COALESCE(t."displayName", t."canonicalName") AS "label"
    FROM "journal_entry_topics" jet
    JOIN "topics" t
      ON t."id" = jet."topicId"
  `;
}

async function readEntries() {
  return prisma.$queryRaw<EntryRow[]>`
    SELECT
      "id",
      "userId",
      "topics",
      "tools",
      "events",
      "media",
      "observations",
      "emotions",
      "actionItems"
    FROM "journal_entries"
  `;
}

async function main() {
  console.log("Iniciando migracion de metadata en español...");

  const hasLegacyTopics = await hasLegacyTopicTables();
  const [entries, legacyTopicRows] = await Promise.all([
    readEntries(),
    hasLegacyTopics ? readLegacyTopicRows() : Promise.resolve([])
  ]);

  const legacyByEntry = new Map<string, TopicRow[]>();

  legacyTopicRows.forEach((row) => {
    const group = legacyByEntry.get(row.journalEntryId) ?? [];
    group.push(row);
    legacyByEntry.set(row.journalEntryId, group);
  });

  for (const entry of entries) {
    const existingTopics = normalizeMetadataList(parseStringArray(entry.topics), "topic");
    const existingTools = normalizeMetadataList(parseStringArray(entry.tools), "tool");
    const existingEvents = normalizeMetadataList(parseStringArray(entry.events), "event");
    const existingMedia = normalizeMetadataList(parseStringArray(entry.media), "media");
    const existingObservations = normalizeMetadataList(
      parseStringArray(entry.observations),
      "observation"
    );
    const existingEmotions = normalizeMetadataList(parseStringArray(entry.emotions), "emotion");
    const existingActionItems = normalizeMetadataList(
      parseStringArray(entry.actionItems),
      "action_item"
    );

    const migrated = (legacyByEntry.get(entry.id) ?? []).reduce(
      (accumulator, row) => {
        const classified = classifyLegacyLabel(row.label);
        accumulator.projects.push(...classified.projects);
        accumulator.topics.push(...classified.topics);
        accumulator.tools.push(...classified.tools);
        accumulator.events.push(...classified.events);
        accumulator.media.push(...classified.media);
        accumulator.observations.push(...classified.observations);
        return accumulator;
      },
      {
        projects: [] as string[],
        topics: [] as string[],
        tools: [] as string[],
        events: [] as string[],
        media: [] as string[],
        observations: [] as string[]
      }
    );

    const normalizedProjects = normalizeEntityList(migrated.projects);

    if (normalizedProjects.length > 0) {
      const projectRecords = await Promise.all(
        normalizedProjects.map((value) =>
          prisma.project.upsert({
            where: {
              userId_canonicalName: {
                userId: entry.userId,
                canonicalName: value.canonicalName
              }
            },
            create: {
              userId: entry.userId,
              canonicalName: value.canonicalName,
              displayName: value.displayName
            },
            update: {
              displayName: value.displayName
            },
            select: {
              id: true
            }
          })
        )
      );

      await prisma.journalEntryProject.deleteMany({
        where: { journalEntryId: entry.id }
      });

      await prisma.journalEntryProject.createMany({
        data: projectRecords.map((project) => ({
          journalEntryId: entry.id,
          projectId: project.id
        })),
        skipDuplicates: true
      });
    }

    await prisma.journalEntry.update({
      where: { id: entry.id },
      data: {
        topics: Array.from(new Set([...existingTopics, ...migrated.topics])),
        tools: Array.from(new Set([...existingTools, ...migrated.tools])),
        events: Array.from(new Set([...existingEvents, ...migrated.events])),
        media: Array.from(new Set([...existingMedia, ...migrated.media])),
        observations: Array.from(
          new Set([...existingObservations, ...migrated.observations])
        ),
        emotions: existingEmotions,
        actionItems: existingActionItems
      }
    });
  }

  if (hasLegacyTopics) {
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "journal_entry_topics";');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "topics";');
    console.log("Tablas legacy de topics eliminadas.");
  }

  console.log(`Migracion completada para ${entries.length} entradas.`);
}

main()
  .catch((error) => {
    console.error("Fallo la migracion de metadata.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

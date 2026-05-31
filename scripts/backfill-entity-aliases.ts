import { EntityAliasType, Prisma } from "@prisma/client";

import {
  dedupeNormalizedEntities,
  normalizeDisplayName,
  normalizeLookupKey,
  toCanonicalSlug
} from "../lib/entity-normalization.ts";
import { prisma } from "../lib/prisma.ts";

type BackfillEntryRow = {
  id: string;
  userId: string;
  topics: unknown;
  tools: unknown;
  events: unknown;
  media: unknown;
  observations: unknown;
  emotions: unknown;
  lessons: unknown;
  ideas: unknown;
  experiences: unknown;
  workKnowledge: unknown;
};

type LinkedProjectRow = {
  journalEntryId: string;
  canonicalName: string;
  displayName: string;
};

type LinkedPersonRow = {
  journalEntryId: string;
  canonicalName: string;
  displayName: string;
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

async function resolveMetadataValues(
  userId: string,
  entityType: EntityAliasType,
  values: string[]
) {
  const resolvedValues = await resolveEntityAliases(userId, entityType, values);

  return Array.from(new Set(resolvedValues.map((value) => value.canonicalName)));
}

async function resolveEntityAliases(
  userId: string,
  entityType: EntityAliasType,
  values: string[]
) {
  const normalizedInputs = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => ({
      sourceValue: value,
      alias: normalizeLookupKey(value)
    }))
    .filter((value) => value.alias);

  if (normalizedInputs.length === 0) {
    return [];
  }

  const records = await prisma.entityAlias.findMany({
    where: {
      userId,
      entityType,
      alias: {
        in: Array.from(new Set(normalizedInputs.map((value) => value.alias)))
      }
    },
    select: {
      id: true,
      alias: true,
      canonicalName: true,
      displayName: true
    }
  });

  const recordsByAlias = new Map(records.map((record) => [record.alias, record]));

  return dedupeNormalizedEntities(
    normalizedInputs
      .map(({ sourceValue, alias }) => {
        const record = recordsByAlias.get(alias);
        const canonicalName = toCanonicalSlug(record?.canonicalName || sourceValue);
        const displayName = normalizeDisplayName(record?.displayName || record?.canonicalName || sourceValue);

        if (!canonicalName || !displayName) {
          return null;
        }

        return {
          canonicalName,
          displayName,
          sourceValue
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
  );
}

async function upsertProjectSet(
  userId: string,
  values: Awaited<ReturnType<typeof resolveEntityAliases>>,
  tx: Prisma.TransactionClient
) {
  if (values.length === 0) {
    return [];
  }

  return Promise.all(
    values.map((value) =>
      tx.project.upsert({
        where: {
          userId_canonicalName: {
            userId,
            canonicalName: value.canonicalName
          }
        },
        create: {
          userId,
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
}

async function upsertPersonSet(
  userId: string,
  values: Awaited<ReturnType<typeof resolveEntityAliases>>,
  tx: Prisma.TransactionClient
) {
  if (values.length === 0) {
    return [];
  }

  return Promise.all(
    values.map((value) =>
      tx.person.upsert({
        where: {
          userId_canonicalName: {
            userId,
            canonicalName: value.canonicalName
          }
        },
        create: {
          userId,
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
}

async function cleanupOrphanEntities() {
  await prisma.$executeRaw`
    DELETE FROM "projects" p
    WHERE NOT EXISTS (
      SELECT 1
      FROM "journal_entry_projects" jep
      WHERE jep."projectId" = p."id"
    )
  `;

  await prisma.$executeRaw`
    DELETE FROM "people" p
    WHERE NOT EXISTS (
      SELECT 1
      FROM "journal_entry_people" jep
      WHERE jep."personId" = p."id"
    )
  `;
}

async function getJournalEntryColumnNames() {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
  `;

  return new Set(rows.map((row) => row.column_name));
}

async function readEntries(columnNames: Set<string>) {
  const selectJsonColumn = (columnName: string) =>
    columnNames.has(columnName)
      ? `"${columnName}"`
      : `'[]'::jsonb AS "${columnName}"`;

  return prisma.$queryRawUnsafe<BackfillEntryRow[]>(`
    SELECT
      "id",
      "userId",
      ${selectJsonColumn("topics")},
      ${selectJsonColumn("tools")},
      ${selectJsonColumn("events")},
      ${selectJsonColumn("media")},
      ${selectJsonColumn("observations")},
      ${selectJsonColumn("emotions")},
      ${selectJsonColumn("lessons")},
      ${selectJsonColumn("ideas")},
      ${selectJsonColumn("experiences")},
      ${selectJsonColumn("workKnowledge")}
    FROM "journal_entries"
    ORDER BY "entryDate" ASC
  `);
}

async function readLinkedProjects() {
  return prisma.$queryRaw<LinkedProjectRow[]>`
    SELECT
      jep."journalEntryId" AS "journalEntryId",
      p."canonicalName" AS "canonicalName",
      p."displayName" AS "displayName"
    FROM "journal_entry_projects" jep
    JOIN "projects" p ON p."id" = jep."projectId"
  `;
}

async function readLinkedPeople() {
  return prisma.$queryRaw<LinkedPersonRow[]>`
    SELECT
      jep."journalEntryId" AS "journalEntryId",
      p."canonicalName" AS "canonicalName",
      p."displayName" AS "displayName"
    FROM "journal_entry_people" jep
    JOIN "people" p ON p."id" = jep."personId"
  `;
}

async function main() {
  console.log("Reprocesando aliases de entidades y metadata...");

  const columnNames = await getJournalEntryColumnNames();
  const [entries, linkedProjects, linkedPeople] = await Promise.all([
    readEntries(columnNames),
    readLinkedProjects(),
    readLinkedPeople()
  ]);

  const projectsByEntry = new Map<string, LinkedProjectRow[]>();
  const peopleByEntry = new Map<string, LinkedPersonRow[]>();

  linkedProjects.forEach((row) => {
    const group = projectsByEntry.get(row.journalEntryId) ?? [];
    group.push(row);
    projectsByEntry.set(row.journalEntryId, group);
  });

  linkedPeople.forEach((row) => {
    const group = peopleByEntry.get(row.journalEntryId) ?? [];
    group.push(row);
    peopleByEntry.set(row.journalEntryId, group);
  });

  let updatedEntries = 0;

  for (const entry of entries) {
    const projectValues = (projectsByEntry.get(entry.id) ?? []).map(
      (project) => project.displayName || project.canonicalName
    );
    const personValues = (peopleByEntry.get(entry.id) ?? []).map(
      (person) => person.displayName || person.canonicalName
    );

    const [
      resolvedProjects,
      resolvedPeople,
      topics,
      tools,
      events,
      media,
      observations,
      emotions
      ,
      lessons,
      ideas,
      experiences,
      workKnowledge
    ] = await Promise.all([
      resolveEntityAliases(entry.userId, EntityAliasType.project, projectValues),
      resolveEntityAliases(entry.userId, EntityAliasType.person, personValues),
      resolveMetadataValues(entry.userId, EntityAliasType.topic, parseStringArray(entry.topics)),
      resolveMetadataValues(entry.userId, EntityAliasType.tool, parseStringArray(entry.tools)),
      resolveMetadataValues(entry.userId, EntityAliasType.event, parseStringArray(entry.events)),
      resolveMetadataValues(entry.userId, EntityAliasType.media, parseStringArray(entry.media)),
      resolveMetadataValues(
        entry.userId,
        EntityAliasType.observation,
        parseStringArray(entry.observations)
      ),
      resolveMetadataValues(entry.userId, EntityAliasType.emotion, parseStringArray(entry.emotions))
      ,
      Promise.resolve(parseStringArray(entry.lessons)),
      Promise.resolve(parseStringArray(entry.ideas)),
      Promise.resolve(parseStringArray(entry.experiences)),
      Promise.resolve(parseStringArray(entry.workKnowledge))
    ]);

    await prisma.$transaction(async (tx) => {
      const [projects, people] = await Promise.all([
        upsertProjectSet(entry.userId, resolvedProjects, tx),
        upsertPersonSet(entry.userId, resolvedPeople, tx)
      ]);

      await Promise.all([
        tx.journalEntryProject.deleteMany({
          where: { journalEntryId: entry.id }
        }),
        tx.journalEntryPerson.deleteMany({
          where: { journalEntryId: entry.id }
        })
      ]);

      await Promise.all([
        projects.length > 0
          ? tx.journalEntryProject.createMany({
              data: projects.map((project) => ({
                journalEntryId: entry.id,
                projectId: project.id
              })),
              skipDuplicates: true
            })
          : Promise.resolve(),
        people.length > 0
          ? tx.journalEntryPerson.createMany({
              data: people.map((person) => ({
                journalEntryId: entry.id,
                personId: person.id
              })),
              skipDuplicates: true
            })
          : Promise.resolve()
      ]);

      const metadataUpdate: Record<string, string[]> = {};

      if (columnNames.has("topics")) {
        metadataUpdate.topics = topics;
      }

      if (columnNames.has("tools")) {
        metadataUpdate.tools = tools;
      }

      if (columnNames.has("events")) {
        metadataUpdate.events = events;
      }

      if (columnNames.has("media")) {
        metadataUpdate.media = media;
      }

      if (columnNames.has("observations")) {
        metadataUpdate.observations = observations;
      }

      if (columnNames.has("emotions")) {
        metadataUpdate.emotions = emotions;
      }

      if (columnNames.has("lessons")) {
        metadataUpdate.lessons = lessons;
      }

      if (columnNames.has("ideas")) {
        metadataUpdate.ideas = ideas;
      }

      if (columnNames.has("experiences")) {
        metadataUpdate.experiences = experiences;
      }

      if (columnNames.has("workKnowledge")) {
        metadataUpdate.workKnowledge = workKnowledge;
      }

      if (Object.keys(metadataUpdate).length > 0) {
        await tx.journalEntry.update({
          where: {
            id: entry.id
          },
          data: metadataUpdate
        });
      }
    });

    updatedEntries += 1;
  }

  await cleanupOrphanEntities();

  console.log(
    JSON.stringify(
      {
        processedEntries: entries.length,
        updatedEntries
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Fallo el reprocesamiento de aliases.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

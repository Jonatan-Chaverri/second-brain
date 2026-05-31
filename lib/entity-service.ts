import { Prisma, PrismaClient } from "@prisma/client";
import { NormalizedEntity } from "@/lib/entity-normalization";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type UpsertedEntityRecord = {
  id: string;
  canonicalName: string;
  displayName: string;
};

async function upsertProjectSet(client: DbClient, userId: string, values: NormalizedEntity[]) {
  if (values.length === 0) {
    return [];
  }

  return Promise.all(
    values.map((value) =>
      client.project.upsert({
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
          id: true,
          canonicalName: true,
          displayName: true
        }
      })
    )
  );
}

async function upsertPersonSet(
  client: DbClient,
  userId: string,
  values: NormalizedEntity[]
) {
  if (values.length === 0) {
    return [];
  }

  return Promise.all(
    values.map((value) =>
      client.person.upsert({
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
          id: true,
          canonicalName: true,
          displayName: true
        }
      })
    )
  );
}

export async function upsertJournalEntities(
  userId: string,
  entities: {
    projects: NormalizedEntity[];
    people: NormalizedEntity[];
  },
  client: DbClient = prisma
) {
  const [projects, people] = await Promise.all([
    upsertProjectSet(client, userId, entities.projects),
    upsertPersonSet(client, userId, entities.people)
  ]);

  return {
    projects,
    people
  };
}

export async function replaceJournalEntryEntityJoins(
  journalEntryId: string,
  entityIds: {
    projectIds: string[];
    personIds: string[];
  },
  client: DbClient = prisma
) {
  await Promise.all([
    client.journalEntryProject.deleteMany({
      where: { journalEntryId }
    }),
    client.journalEntryPerson.deleteMany({
      where: { journalEntryId }
    })
  ]);

  await Promise.all([
    entityIds.projectIds.length
      ? client.journalEntryProject.createMany({
          data: entityIds.projectIds.map((projectId) => ({
            journalEntryId,
            projectId
          })),
          skipDuplicates: true
        })
      : Promise.resolve(),
    entityIds.personIds.length
      ? client.journalEntryPerson.createMany({
          data: entityIds.personIds.map((personId) => ({
            journalEntryId,
            personId
          })),
          skipDuplicates: true
        })
      : Promise.resolve()
  ]);
}

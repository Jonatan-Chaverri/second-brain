import { EntityAliasType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  normalizeDisplayName,
  normalizeLookupKey,
  toCanonicalSlug
} from "@/lib/entity-normalization";

export type PersonRecord = {
  id: string;
  canonicalName: string;
  displayName: string;
  notes: string | null;
  birthday: string | null;
  aliases: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type RawPerson = {
  id: string;
  canonicalName: string;
  displayName: string;
  notes: string | null;
  birthday: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function formatDateOnly(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function toPersonRecord(
  person: RawPerson,
  aliases: string[],
  tags: string[]
): PersonRecord {
  return {
    id: person.id,
    canonicalName: person.canonicalName,
    displayName: person.displayName,
    notes: person.notes,
    birthday: formatDateOnly(person.birthday),
    aliases,
    tags,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString()
  };
}

async function loadAliasesByCanonical(userId: string, canonicalNames: string[]) {
  if (canonicalNames.length === 0) {
    return new Map<string, string[]>();
  }

  const records = await prisma.entityAlias.findMany({
    where: {
      userId,
      entityType: EntityAliasType.person,
      canonicalName: { in: canonicalNames }
    },
    select: {
      alias: true,
      canonicalName: true
    },
    orderBy: { alias: "asc" }
  });

  const grouped = new Map<string, string[]>();

  for (const record of records) {
    const list = grouped.get(record.canonicalName) ?? [];
    list.push(record.alias);
    grouped.set(record.canonicalName, list);
  }

  return grouped;
}

export async function listPeopleForUser(userId: string): Promise<PersonRecord[]> {
  const people = await prisma.person.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      canonicalName: true,
      displayName: true,
      notes: true,
      birthday: true,
      createdAt: true,
      updatedAt: true,
      tags: {
        select: {
          tag: { select: { displayName: true } }
        }
      }
    }
  });

  const aliasesByCanonical = await loadAliasesByCanonical(
    userId,
    people.map((person) => person.canonicalName)
  );

  return people.map((person) =>
    toPersonRecord(
      person,
      aliasesByCanonical.get(person.canonicalName) ?? [],
      person.tags.map((row) => row.tag.displayName).sort((left, right) => left.localeCompare(right))
    )
  );
}

function parseBirthday(value: string | null | undefined): Date | null {
  if (value === undefined) {
    return undefined as unknown as Date | null;
  }

  if (value === null || value === "") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("Invalid birthday format. Use YYYY-MM-DD.");
  }

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid birthday date.");
  }

  return parsed;
}

function normalizeAliasList(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeLookupKey(value);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

async function replacePersonAliases(
  tx: Prisma.TransactionClient,
  userId: string,
  canonicalName: string,
  displayName: string,
  aliases: string[]
) {
  await tx.entityAlias.deleteMany({
    where: {
      userId,
      entityType: EntityAliasType.person,
      canonicalName
    }
  });

  if (aliases.length === 0) {
    return;
  }

  // Free up any aliases that are already taken by other canonical names so we
  // can reassign them to this person without violating the unique
  // (userId, entityType, alias) constraint.
  await tx.entityAlias.deleteMany({
    where: {
      userId,
      entityType: EntityAliasType.person,
      alias: { in: aliases }
    }
  });

  await tx.entityAlias.createMany({
    data: aliases.map((alias) => ({
      userId,
      entityType: EntityAliasType.person,
      alias,
      canonicalName,
      displayName
    })),
    skipDuplicates: true
  });
}

function normalizeTagInput(values: string[]) {
  const seen = new Set<string>();
  const result: Array<{ canonicalName: string; displayName: string }> = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const canonicalName = toCanonicalSlug(trimmed);
    if (!canonicalName || seen.has(canonicalName)) continue;

    const displayName = normalizeDisplayName(trimmed);
    if (!displayName) continue;

    seen.add(canonicalName);
    result.push({ canonicalName, displayName });
  }

  return result;
}

async function replacePersonTags(
  tx: Prisma.TransactionClient,
  userId: string,
  personId: string,
  tagValues: string[]
) {
  const normalized = normalizeTagInput(tagValues);

  await tx.personTag.deleteMany({ where: { personId } });

  if (normalized.length === 0) {
    return;
  }

  const tagIds: string[] = [];

  for (const tag of normalized) {
    const upserted = await tx.tag.upsert({
      where: {
        userId_canonicalName: {
          userId,
          canonicalName: tag.canonicalName
        }
      },
      create: {
        userId,
        canonicalName: tag.canonicalName,
        displayName: tag.displayName
      },
      update: {
        displayName: tag.displayName
      },
      select: { id: true }
    });

    tagIds.push(upserted.id);
  }

  await tx.personTag.createMany({
    data: tagIds.map((tagId) => ({ personId, tagId })),
    skipDuplicates: true
  });
}

async function loadTagsByPersonIds(userId: string, personIds: string[]) {
  if (personIds.length === 0) {
    return new Map<string, string[]>();
  }

  const rows = await prisma.personTag.findMany({
    where: {
      personId: { in: personIds },
      tag: { userId }
    },
    select: {
      personId: true,
      tag: { select: { displayName: true } }
    }
  });

  const grouped = new Map<string, string[]>();

  for (const row of rows) {
    const list = grouped.get(row.personId) ?? [];
    list.push(row.tag.displayName);
    grouped.set(row.personId, list);
  }

  for (const [personId, list] of grouped) {
    grouped.set(
      personId,
      list.sort((left, right) => left.localeCompare(right))
    );
  }

  return grouped;
}

export type TagRecord = {
  id: string;
  canonicalName: string;
  displayName: string;
  personCount: number;
};

export async function listTagsForUser(userId: string): Promise<TagRecord[]> {
  const tags = await prisma.tag.findMany({
    where: { userId },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      canonicalName: true,
      displayName: true,
      _count: { select: { people: true } }
    }
  });

  return tags.map((tag) => ({
    id: tag.id,
    canonicalName: tag.canonicalName,
    displayName: tag.displayName,
    personCount: tag._count.people
  }));
}

export async function findPersonCanonicalNamesByTagLabels(
  userId: string,
  labels: string[]
): Promise<string[]> {
  const slugs = Array.from(
    new Set(labels.map((label) => toCanonicalSlug(label)).filter(Boolean))
  );

  if (slugs.length === 0) {
    return [];
  }

  const rows = await prisma.person.findMany({
    where: {
      userId,
      tags: {
        some: {
          tag: { canonicalName: { in: slugs } }
        }
      }
    },
    select: { canonicalName: true }
  });

  return Array.from(new Set(rows.map((row) => row.canonicalName)));
}

export type CreatePersonInput = {
  userId: string;
  displayName: string;
  notes?: string | null;
  birthday?: string | null;
  aliases?: string[];
  tags?: string[];
};

export async function createPerson(input: CreatePersonInput): Promise<PersonRecord> {
  const displayName = normalizeDisplayName(input.displayName);

  if (!displayName) {
    throw new Error("Display name cannot be empty.");
  }

  const canonicalName = canonicalizeName(displayName);

  if (!canonicalName) {
    throw new Error("Display name cannot be empty.");
  }

  const existing = await prisma.person.findFirst({
    where: { userId: input.userId, canonicalName },
    select: { id: true }
  });

  if (existing) {
    throw new Error("PERSON_ALREADY_EXISTS");
  }

  const birthdayValue =
    input.birthday === undefined ? undefined : parseBirthday(input.birthday ?? null);
  const notesValue = input.notes !== undefined ? input.notes?.trim() || null : null;

  const created = await prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        userId: input.userId,
        canonicalName,
        displayName,
        notes: notesValue,
        ...(birthdayValue !== undefined ? { birthday: birthdayValue } : {})
      },
      select: {
        id: true,
        canonicalName: true,
        displayName: true,
        notes: true,
        birthday: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (input.aliases && input.aliases.length > 0) {
      const normalizedAliases = normalizeAliasList(input.aliases);
      await replacePersonAliases(
        tx,
        input.userId,
        person.canonicalName,
        person.displayName,
        normalizedAliases
      );
    }

    if (input.tags && input.tags.length > 0) {
      await replacePersonTags(tx, input.userId, person.id, input.tags);
    }

    return person;
  });

  const aliasesByCanonical = await loadAliasesByCanonical(input.userId, [created.canonicalName]);
  const tagsByPersonId = await loadTagsByPersonIds(input.userId, [created.id]);
  return toPersonRecord(
    created,
    aliasesByCanonical.get(created.canonicalName) ?? [],
    tagsByPersonId.get(created.id) ?? []
  );
}

export type UpdatePersonInput = {
  userId: string;
  id: string;
  displayName?: string;
  notes?: string | null;
  birthday?: string | null;
  aliases?: string[];
  tags?: string[];
};

export async function updatePerson(input: UpdatePersonInput): Promise<PersonRecord> {
  const person = await prisma.person.findFirst({
    where: { id: input.id, userId: input.userId },
    select: { id: true, canonicalName: true, displayName: true }
  });

  if (!person) {
    throw new Error("PERSON_NOT_FOUND");
  }

  const nextDisplayName = input.displayName
    ? normalizeDisplayName(input.displayName)
    : person.displayName;

  if (!nextDisplayName) {
    throw new Error("Display name cannot be empty.");
  }

  const birthdayValue =
    input.birthday === undefined ? undefined : parseBirthday(input.birthday ?? null);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPerson = await tx.person.update({
      where: { id: person.id },
      data: {
        displayName: nextDisplayName,
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(birthdayValue !== undefined ? { birthday: birthdayValue } : {})
      },
      select: {
        id: true,
        canonicalName: true,
        displayName: true,
        notes: true,
        birthday: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (input.aliases) {
      const normalizedAliases = normalizeAliasList(input.aliases);
      await replacePersonAliases(
        tx,
        input.userId,
        updatedPerson.canonicalName,
        updatedPerson.displayName,
        normalizedAliases
      );
    }

    if (input.tags) {
      await replacePersonTags(tx, input.userId, updatedPerson.id, input.tags);
    }

    return updatedPerson;
  });

  const aliasesByCanonical = await loadAliasesByCanonical(input.userId, [updated.canonicalName]);
  const tagsByPersonId = await loadTagsByPersonIds(input.userId, [updated.id]);
  return toPersonRecord(
    updated,
    aliasesByCanonical.get(updated.canonicalName) ?? [],
    tagsByPersonId.get(updated.id) ?? []
  );
}

export async function deletePerson(userId: string, id: string) {
  const person = await prisma.person.findFirst({
    where: { id, userId },
    select: { id: true, canonicalName: true }
  });

  if (!person) {
    throw new Error("PERSON_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.entityAlias.deleteMany({
      where: {
        userId,
        entityType: EntityAliasType.person,
        canonicalName: person.canonicalName
      }
    });

    await tx.person.delete({ where: { id: person.id } });
  });
}

export type PersonDirectoryEntry = {
  displayName: string;
  notes: string | null;
  birthday: string | null;
  aliases: string[];
  tags: string[];
};

export async function getPersonDirectoryForCanonicalNames(
  userId: string,
  canonicalNames: string[]
): Promise<PersonDirectoryEntry[]> {
  if (canonicalNames.length === 0) {
    return [];
  }

  const unique = Array.from(new Set(canonicalNames));

  const people = await prisma.person.findMany({
    where: {
      userId,
      canonicalName: { in: unique }
    },
    select: {
      id: true,
      canonicalName: true,
      displayName: true,
      notes: true,
      birthday: true,
      tags: {
        select: {
          tag: { select: { displayName: true } }
        }
      }
    }
  });

  const filtered = people.filter(
    (person) => person.notes || person.birthday || person.tags.length > 0
  );

  if (filtered.length === 0) {
    return [];
  }

  const aliasesByCanonical = await loadAliasesByCanonical(
    userId,
    filtered.map((person) => person.canonicalName)
  );

  return filtered.map((person) => ({
    displayName: person.displayName,
    notes: person.notes,
    birthday: formatDateOnly(person.birthday),
    aliases: aliasesByCanonical.get(person.canonicalName) ?? [],
    tags: person.tags
      .map((row) => row.tag.displayName)
      .sort((left, right) => left.localeCompare(right))
  }));
}

export function canonicalizeName(value: string) {
  return toCanonicalSlug(value);
}

import { EntityAliasType, Prisma } from "@prisma/client";

import {
  NormalizedEntity,
  dedupeNormalizedEntities,
  normalizeDisplayName,
  normalizeLookupKey,
  toCanonicalSlug
} from "@/lib/entity-normalization";
import { prisma } from "@/lib/prisma";

export type AliasResolution = NormalizedEntity & {
  aliasRecordId: string | null;
  matchedAlias: string | null;
};

type CreateEntityAliasInput = {
  userId: string;
  entityType: EntityAliasType;
  alias: string;
  canonicalName: string;
  displayName?: string | null;
};

type UpdateEntityAliasInput = {
  userId: string;
  id: string;
  alias?: string;
  canonicalName?: string;
  displayName?: string | null;
};

function normalizeAliasValue(value: string) {
  return normalizeLookupKey(value);
}

function normalizeCanonicalValue(value: string) {
  return toCanonicalSlug(value);
}

function buildFallbackResolution(sourceValue: string): AliasResolution | null {
  const canonicalName = normalizeCanonicalValue(sourceValue);
  const displayName = normalizeDisplayName(sourceValue);

  if (!canonicalName || !displayName) {
    return null;
  }

  return {
    aliasRecordId: null,
    matchedAlias: null,
    canonicalName,
    displayName,
    sourceValue
  };
}

function buildAliasResolution(
  sourceValue: string,
  record: {
    id: string;
    alias: string;
    canonicalName: string;
    displayName: string | null;
  }
): AliasResolution | null {
  const canonicalName = normalizeCanonicalValue(record.canonicalName);
  const displayName = normalizeDisplayName(
    record.displayName?.trim() || record.canonicalName
  );

  if (!canonicalName || !displayName) {
    return null;
  }

  return {
    aliasRecordId: record.id,
    matchedAlias: record.alias,
    canonicalName,
    displayName,
    sourceValue
  };
}

function requireNormalizedValue(label: string, value: string) {
  if (!value) {
    throw new Error(`Entity alias ${label} cannot be empty.`);
  }

  return value;
}

export async function resolveEntityAlias(
  userId: string,
  entityType: EntityAliasType,
  value: string
): Promise<AliasResolution | null> {
  const normalizedAlias = normalizeAliasValue(value);

  if (!normalizedAlias) {
    return null;
  }

  const record = await prisma.entityAlias.findUnique({
    where: {
      userId_entityType_alias: {
        userId,
        entityType,
        alias: normalizedAlias
      }
    },
    select: {
      id: true,
      alias: true,
      canonicalName: true,
      displayName: true
    }
  });

  if (!record) {
    return buildFallbackResolution(value);
  }

  return buildAliasResolution(value, record);
}

export async function resolveEntityAliases(
  userId: string,
  entityType: EntityAliasType,
  values: string[]
): Promise<AliasResolution[]> {
  const normalizedInputs = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => ({
      sourceValue: value,
      alias: normalizeAliasValue(value)
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

  const resolvedValues = normalizedInputs
    .map(({ sourceValue, alias }) => {
      const record = recordsByAlias.get(alias);

      if (record) {
        return buildAliasResolution(sourceValue, record);
      }

      return buildFallbackResolution(sourceValue);
    })
    .filter((value): value is AliasResolution => value !== null);

  const deduped = dedupeNormalizedEntities(resolvedValues);

  return deduped.map((value) => {
    const matched = resolvedValues.find(
      (candidate) => candidate.canonicalName === value.canonicalName
    );

    return {
      aliasRecordId: matched?.aliasRecordId ?? null,
      matchedAlias: matched?.matchedAlias ?? null,
      canonicalName: value.canonicalName,
      displayName: value.displayName,
      sourceValue: value.sourceValue
    };
  });
}

export async function createEntityAlias(input: CreateEntityAliasInput) {
  const alias = requireNormalizedValue("alias", normalizeAliasValue(input.alias));
  const canonicalName = requireNormalizedValue(
    "canonical name",
    normalizeCanonicalValue(input.canonicalName)
  );
  const displayName = normalizeDisplayName(input.displayName?.trim() || input.canonicalName);

  return prisma.entityAlias.create({
    data: {
      userId: input.userId,
      entityType: input.entityType,
      alias,
      canonicalName,
      displayName: displayName || null
    }
  });
}

export async function updateEntityAlias(input: UpdateEntityAliasInput) {
  const existingAlias = await prisma.entityAlias.findFirstOrThrow({
    where: {
      id: input.id,
      userId: input.userId
    },
    select: {
      id: true,
      canonicalName: true
    }
  });

  const data: Prisma.EntityAliasUpdateInput = {};

  if (input.alias !== undefined) {
    data.alias = requireNormalizedValue("alias", normalizeAliasValue(input.alias));
  }

  if (input.canonicalName !== undefined) {
    data.canonicalName = requireNormalizedValue(
      "canonical name",
      normalizeCanonicalValue(input.canonicalName)
    );
  }

  if (input.displayName !== undefined) {
    const fallbackDisplaySource =
      input.canonicalName || existingAlias.canonicalName;
    const displayName = normalizeDisplayName(input.displayName || fallbackDisplaySource);

    data.displayName = displayName || null;
  }

  return prisma.entityAlias.update({
    where: {
      id: existingAlias.id
    },
    data
  });
}

export async function deleteEntityAlias(userId: string, id: string) {
  const existingAlias = await prisma.entityAlias.findFirstOrThrow({
    where: {
      id,
      userId
    },
    select: {
      id: true
    }
  });

  return prisma.entityAlias.delete({
    where: {
      id: existingAlias.id
    }
  });
}

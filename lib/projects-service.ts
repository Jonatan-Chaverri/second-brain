import { EntityAliasType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  normalizeDisplayName,
  normalizeLookupKey,
  toCanonicalSlug
} from "@/lib/entity-normalization";
import { generateEmbedding } from "@/lib/openai";
import { setProjectEmbedding } from "@/lib/vector";

function buildProjectEmbeddingSource(parts: {
  displayName: string;
  description: string | null;
  status: string | null;
  notes: string | null;
  technologies: string[];
  aliases: string[];
  tags: string[];
}): string {
  const pieces = [
    parts.displayName,
    ...parts.aliases,
    ...parts.tags,
    ...parts.technologies,
    parts.status,
    parts.description,
    parts.notes
  ];
  return pieces
    .map((value) => (value ?? "").toString().trim())
    .filter((value) => value.length > 0)
    .join(" ")
    .trim();
}

async function refreshProjectEmbedding(input: {
  userId: string;
  projectId: string;
  canonicalName: string;
  displayName: string;
  description: string | null;
  status: string | null;
  notes: string | null;
  technologies: string[];
}) {
  const aliasesByCanonical = await loadAliasesByCanonical(input.userId, [input.canonicalName]);
  const tagsByProjectId = await loadTagsByProjectIds(input.userId, [input.projectId]);
  const aliases = aliasesByCanonical.get(input.canonicalName) ?? [];
  const tags = tagsByProjectId.get(input.projectId) ?? [];
  const source = buildProjectEmbeddingSource({
    displayName: input.displayName,
    description: input.description,
    status: input.status,
    notes: input.notes,
    technologies: input.technologies,
    aliases,
    tags
  });

  try {
    if (!source) {
      await setProjectEmbedding(input.projectId, null);
      return;
    }
    const embedding = await generateEmbedding(source, input.userId);
    await setProjectEmbedding(input.projectId, embedding);
  } catch (error) {
    // Do not break project saves if embedding generation fails.
    console.error("[projects-service] Failed to refresh project embedding", error);
  }
}

export const PROJECT_STATUS_OPTIONS = [
  "idea",
  "active",
  "on-hold",
  "completed",
  "abandoned"
] as const;

export type ProjectStatus = (typeof PROJECT_STATUS_OPTIONS)[number];

export type ProjectRecord = {
  id: string;
  canonicalName: string;
  displayName: string;
  description: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  technologies: string[];
  notes: string | null;
  aliases: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type RawProject = {
  id: string;
  canonicalName: string;
  displayName: string;
  description: string | null;
  status: string | null;
  startDate: Date | null;
  endDate: Date | null;
  technologies: Prisma.JsonValue;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function formatDateOnly(value: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toProjectRecord(
  project: RawProject,
  aliases: string[],
  tags: string[]
): ProjectRecord {
  return {
    id: project.id,
    canonicalName: project.canonicalName,
    displayName: project.displayName,
    description: project.description,
    status: project.status,
    startDate: formatDateOnly(project.startDate),
    endDate: formatDateOnly(project.endDate),
    technologies: parseStringArray(project.technologies),
    notes: project.notes,
    aliases,
    tags,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

const projectSelect = {
  id: true,
  canonicalName: true,
  displayName: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
  technologies: true,
  notes: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ProjectSelect;

async function loadAliasesByCanonical(userId: string, canonicalNames: string[]) {
  if (canonicalNames.length === 0) {
    return new Map<string, string[]>();
  }

  const records = await prisma.entityAlias.findMany({
    where: {
      userId,
      entityType: EntityAliasType.project,
      canonicalName: { in: canonicalNames }
    },
    select: { alias: true, canonicalName: true },
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

async function loadTagsByProjectIds(userId: string, projectIds: string[]) {
  if (projectIds.length === 0) {
    return new Map<string, string[]>();
  }

  const rows = await prisma.projectTag.findMany({
    where: {
      projectId: { in: projectIds },
      tag: { userId }
    },
    select: {
      projectId: true,
      tag: { select: { displayName: true } }
    }
  });

  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.projectId) ?? [];
    list.push(row.tag.displayName);
    grouped.set(row.projectId, list);
  }
  for (const [id, list] of grouped) {
    grouped.set(
      id,
      list.sort((left, right) => left.localeCompare(right))
    );
  }
  return grouped;
}

export async function listProjectsForUser(userId: string): Promise<ProjectRecord[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: projectSelect
  });

  const aliasesByCanonical = await loadAliasesByCanonical(
    userId,
    projects.map((project) => project.canonicalName)
  );
  const tagsByProjectId = await loadTagsByProjectIds(
    userId,
    projects.map((project) => project.id)
  );

  return projects.map((project) =>
    toProjectRecord(
      project,
      aliasesByCanonical.get(project.canonicalName) ?? [],
      tagsByProjectId.get(project.id) ?? []
    )
  );
}

function parseDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date.");
  }
  return parsed;
}

function normalizeAliasList(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeLookupKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeTechList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

async function replaceProjectAliases(
  tx: Prisma.TransactionClient,
  userId: string,
  canonicalName: string,
  displayName: string,
  aliases: string[]
) {
  await tx.entityAlias.deleteMany({
    where: { userId, entityType: EntityAliasType.project, canonicalName }
  });

  if (aliases.length === 0) return;

  await tx.entityAlias.deleteMany({
    where: { userId, entityType: EntityAliasType.project, alias: { in: aliases } }
  });

  await tx.entityAlias.createMany({
    data: aliases.map((alias) => ({
      userId,
      entityType: EntityAliasType.project,
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

async function replaceProjectTags(
  tx: Prisma.TransactionClient,
  userId: string,
  projectId: string,
  tagValues: string[]
) {
  const normalized = normalizeTagInput(tagValues);

  await tx.projectTag.deleteMany({ where: { projectId } });

  if (normalized.length === 0) return;

  const tagIds: string[] = [];

  for (const tag of normalized) {
    const upserted = await tx.tag.upsert({
      where: {
        userId_scope_canonicalName: {
          userId,
          scope: "project",
          canonicalName: tag.canonicalName
        }
      },
      create: {
        userId,
        scope: "project",
        canonicalName: tag.canonicalName,
        displayName: tag.displayName
      },
      update: { displayName: tag.displayName },
      select: { id: true }
    });
    tagIds.push(upserted.id);
  }

  await tx.projectTag.createMany({
    data: tagIds.map((tagId) => ({ projectId, tagId })),
    skipDuplicates: true
  });
}

export type CreateProjectInput = {
  userId: string;
  displayName: string;
  description?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  technologies?: string[];
  notes?: string | null;
  aliases?: string[];
  tags?: string[];
};

export function canonicalizeProjectName(value: string) {
  return toCanonicalSlug(value);
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const displayName = normalizeDisplayName(input.displayName);
  if (!displayName) {
    throw new Error("Display name cannot be empty.");
  }
  const canonicalName = canonicalizeProjectName(displayName);
  if (!canonicalName) {
    throw new Error("Display name cannot be empty.");
  }

  const existing = await prisma.project.findFirst({
    where: { userId: input.userId, canonicalName },
    select: { id: true }
  });
  if (existing) {
    throw new Error("PROJECT_ALREADY_EXISTS");
  }

  const startDateValue = parseDateOnly(input.startDate);
  const endDateValue = parseDateOnly(input.endDate);
  const technologies = input.technologies ? normalizeTechList(input.technologies) : [];

  const created = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        userId: input.userId,
        canonicalName,
        displayName,
        description: input.description?.trim() || null,
        status: input.status?.trim() || null,
        notes: input.notes?.trim() || null,
        technologies,
        ...(startDateValue !== undefined ? { startDate: startDateValue } : {}),
        ...(endDateValue !== undefined ? { endDate: endDateValue } : {})
      },
      select: projectSelect
    });

    if (input.aliases && input.aliases.length > 0) {
      const normalizedAliases = normalizeAliasList(input.aliases);
      await replaceProjectAliases(
        tx,
        input.userId,
        project.canonicalName,
        project.displayName,
        normalizedAliases
      );
    }

    if (input.tags && input.tags.length > 0) {
      await replaceProjectTags(tx, input.userId, project.id, input.tags);
    }

    return project;
  });

  const aliasesByCanonical = await loadAliasesByCanonical(input.userId, [created.canonicalName]);
  const tagsByProjectId = await loadTagsByProjectIds(input.userId, [created.id]);

  await refreshProjectEmbedding({
    userId: input.userId,
    projectId: created.id,
    canonicalName: created.canonicalName,
    displayName: created.displayName,
    description: created.description,
    status: created.status,
    notes: created.notes,
    technologies: parseStringArray(created.technologies)
  });

  return toProjectRecord(
    created,
    aliasesByCanonical.get(created.canonicalName) ?? [],
    tagsByProjectId.get(created.id) ?? []
  );
}

export type UpdateProjectInput = {
  userId: string;
  id: string;
  displayName?: string;
  description?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  technologies?: string[];
  notes?: string | null;
  aliases?: string[];
  tags?: string[];
};

export async function updateProject(input: UpdateProjectInput): Promise<ProjectRecord> {
  const project = await prisma.project.findFirst({
    where: { id: input.id, userId: input.userId },
    select: { id: true, canonicalName: true, displayName: true }
  });
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const nextDisplayName = input.displayName
    ? normalizeDisplayName(input.displayName)
    : project.displayName;
  if (!nextDisplayName) {
    throw new Error("Display name cannot be empty.");
  }

  const startDateValue = parseDateOnly(input.startDate);
  const endDateValue = parseDateOnly(input.endDate);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id: project.id },
      data: {
        displayName: nextDisplayName,
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.technologies !== undefined
          ? { technologies: normalizeTechList(input.technologies) }
          : {}),
        ...(startDateValue !== undefined ? { startDate: startDateValue } : {}),
        ...(endDateValue !== undefined ? { endDate: endDateValue } : {})
      },
      select: projectSelect
    });

    if (input.aliases) {
      const normalizedAliases = normalizeAliasList(input.aliases);
      await replaceProjectAliases(
        tx,
        input.userId,
        updatedProject.canonicalName,
        updatedProject.displayName,
        normalizedAliases
      );
    }

    if (input.tags) {
      await replaceProjectTags(tx, input.userId, updatedProject.id, input.tags);
    }

    return updatedProject;
  });

  const aliasesByCanonical = await loadAliasesByCanonical(input.userId, [updated.canonicalName]);
  const tagsByProjectId = await loadTagsByProjectIds(input.userId, [updated.id]);

  await refreshProjectEmbedding({
    userId: input.userId,
    projectId: updated.id,
    canonicalName: updated.canonicalName,
    displayName: updated.displayName,
    description: updated.description,
    status: updated.status,
    notes: updated.notes,
    technologies: parseStringArray(updated.technologies)
  });

  return toProjectRecord(
    updated,
    aliasesByCanonical.get(updated.canonicalName) ?? [],
    tagsByProjectId.get(updated.id) ?? []
  );
}

export async function deleteProject(userId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true, canonicalName: true }
  });
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.entityAlias.deleteMany({
      where: {
        userId,
        entityType: EntityAliasType.project,
        canonicalName: project.canonicalName
      }
    });
    await tx.project.delete({ where: { id: project.id } });
  });
}

export type ProjectDirectoryEntry = {
  displayName: string;
  description: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  technologies: string[];
  notes: string | null;
  aliases: string[];
  tags: string[];
};

function hasAnyContext(project: RawProject, tagsCount: number) {
  return Boolean(
    project.description ||
      project.status ||
      project.startDate ||
      project.endDate ||
      project.notes ||
      parseStringArray(project.technologies).length > 0 ||
      tagsCount > 0
  );
}

export async function getProjectDirectoryForUser(
  userId: string
): Promise<ProjectDirectoryEntry[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: projectSelect
  });
  return buildProjectDirectoryEntries(userId, projects);
}

export async function getProjectDirectoryForCanonicalNames(
  userId: string,
  canonicalNames: string[]
): Promise<ProjectDirectoryEntry[]> {
  if (canonicalNames.length === 0) return [];
  const projects = await prisma.project.findMany({
    where: { userId, canonicalName: { in: canonicalNames } },
    orderBy: { updatedAt: "desc" },
    select: projectSelect
  });
  return buildProjectDirectoryEntries(userId, projects);
}

export async function listProjectNameIndexForUser(userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { displayName: "asc" },
    select: { displayName: true }
  });
  return projects.map((project) => project.displayName);
}

export type ProjectTagRecord = {
  id: string;
  canonicalName: string;
  displayName: string;
  projectCount: number;
};

export async function listProjectTagsForUser(
  userId: string
): Promise<ProjectTagRecord[]> {
  const tags = await prisma.tag.findMany({
    where: { userId, scope: "project" },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      canonicalName: true,
      displayName: true,
      _count: { select: { projects: true } }
    }
  });

  return tags.map((tag) => ({
    id: tag.id,
    canonicalName: tag.canonicalName,
    displayName: tag.displayName,
    projectCount: tag._count.projects
  }));
}

async function buildProjectDirectoryEntries(
  userId: string,
  projects: RawProject[]
): Promise<ProjectDirectoryEntry[]> {
  if (projects.length === 0) return [];

  const tagsByProjectId = await loadTagsByProjectIds(
    userId,
    projects.map((project) => project.id)
  );
  const aliasesByCanonical = await loadAliasesByCanonical(
    userId,
    projects.map((project) => project.canonicalName)
  );

  const filtered = projects.filter((project) =>
    hasAnyContext(project, tagsByProjectId.get(project.id)?.length ?? 0)
  );

  return filtered.map((project) => ({
    displayName: project.displayName,
    description: project.description,
    status: project.status,
    startDate: formatDateOnly(project.startDate),
    endDate: formatDateOnly(project.endDate),
    technologies: parseStringArray(project.technologies),
    notes: project.notes,
    aliases: aliasesByCanonical.get(project.canonicalName) ?? [],
    tags: tagsByProjectId.get(project.id) ?? []
  }));
}

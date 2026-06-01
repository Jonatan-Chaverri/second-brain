import { EntityAliasType, Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { prisma } from "../lib/prisma.ts";

function formatVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

async function writeProjectEmbedding(projectId: string, embedding: number[] | null) {
  if (!embedding) {
    await prisma.$executeRaw`UPDATE "projects" SET "embedding" = NULL WHERE "id" = ${projectId}`;
    return;
  }
  const literal = formatVectorLiteral(embedding);
  await prisma.$executeRaw`UPDATE "projects" SET "embedding" = ${literal}::extensions.vector(1536) WHERE "id" = ${projectId}`;
}

function loadDotEnv() {
  try {
    const raw = readFileSync(resolvePath(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

loadDotEnv();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

if (!OPENAI_API_KEY) {
  console.error("[backfill] OPENAI_API_KEY is not set.");
  process.exit(1);
}

async function generateEmbedding(input: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI embeddings request failed: ${response.status} ${text}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("OpenAI embeddings response was empty.");
  }
  return embedding;
}

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function buildSource(parts: {
  displayName: string;
  description: string | null;
  status: string | null;
  notes: string | null;
  technologies: string[];
  aliases: string[];
  tags: string[];
}): string {
  return [
    parts.displayName,
    ...parts.aliases,
    ...parts.tags,
    ...parts.technologies,
    parts.status,
    parts.description,
    parts.notes
  ]
    .map((value) => (value ?? "").toString().trim())
    .filter((value) => value.length > 0)
    .join(" ")
    .trim();
}

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      canonicalName: true,
      displayName: true,
      description: true,
      status: true,
      notes: true,
      technologies: true
    }
  });

  console.log(`[backfill] Found ${projects.length} project(s).`);

  if (projects.length === 0) return;

  const projectIds = projects.map((project) => project.id);
  const canonicalByUser = new Map<string, string[]>();
  for (const project of projects) {
    const list = canonicalByUser.get(project.userId) ?? [];
    list.push(project.canonicalName);
    canonicalByUser.set(project.userId, list);
  }

  const aliasesByKey = new Map<string, string[]>(); // key = userId|canonicalName
  for (const [userId, canonicalNames] of canonicalByUser) {
    const aliasRows = await prisma.entityAlias.findMany({
      where: {
        userId,
        entityType: EntityAliasType.project,
        canonicalName: { in: canonicalNames }
      },
      select: { alias: true, canonicalName: true }
    });
    for (const row of aliasRows) {
      const key = `${userId}|${row.canonicalName}`;
      const list = aliasesByKey.get(key) ?? [];
      list.push(row.alias);
      aliasesByKey.set(key, list);
    }
  }

  const tagRows = await prisma.projectTag.findMany({
    where: { projectId: { in: projectIds } },
    select: { projectId: true, tag: { select: { displayName: true } } }
  });
  const tagsByProjectId = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsByProjectId.get(row.projectId) ?? [];
    list.push(row.tag.displayName);
    tagsByProjectId.set(row.projectId, list);
  }

  let updated = 0;
  let cleared = 0;
  let failed = 0;

  for (const project of projects) {
    const aliases = aliasesByKey.get(`${project.userId}|${project.canonicalName}`) ?? [];
    const tags = tagsByProjectId.get(project.id) ?? [];
    const source = buildSource({
      displayName: project.displayName,
      description: project.description,
      status: project.status,
      notes: project.notes,
      technologies: parseStringArray(project.technologies),
      aliases,
      tags
    });

    if (!source) {
      await writeProjectEmbedding(project.id, null);
      cleared += 1;
      console.log(`[backfill] cleared ${project.displayName} (no source)`);
      continue;
    }

    try {
      const embedding = await generateEmbedding(source);
      await writeProjectEmbedding(project.id, embedding);
      updated += 1;
      console.log(`[backfill] embedded ${project.displayName}`);
    } catch (error) {
      failed += 1;
      console.error(`[backfill] failed for ${project.displayName}`, error);
    }
  }

  console.log(
    `[backfill] Done. updated=${updated} cleared=${cleared} failed=${failed} total=${projects.length}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

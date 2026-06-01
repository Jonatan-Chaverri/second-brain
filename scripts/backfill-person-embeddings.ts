import { EntityAliasType } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { prisma } from "../lib/prisma.ts";

function formatVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

async function writePersonEmbedding(personId: string, embedding: number[] | null) {
  if (!embedding) {
    await prisma.$executeRaw`UPDATE "people" SET "embedding" = NULL WHERE "id" = ${personId}`;
    return;
  }
  const literal = formatVectorLiteral(embedding);
  await prisma.$executeRaw`UPDATE "people" SET "embedding" = ${literal}::extensions.vector(1536) WHERE "id" = ${personId}`;
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

function buildSource(parts: {
  displayName: string;
  notes: string | null;
  aliases: string[];
  tags: string[];
}): string {
  return [parts.displayName, ...parts.aliases, ...parts.tags, parts.notes]
    .map((value) => (value ?? "").toString().trim())
    .filter((value) => value.length > 0)
    .join(" ")
    .trim();
}

async function main() {
  const people = await prisma.person.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      canonicalName: true,
      displayName: true,
      notes: true
    }
  });

  console.log(`[backfill] Found ${people.length} person(s).`);

  if (people.length === 0) return;

  const personIds = people.map((person) => person.id);
  const canonicalByUser = new Map<string, string[]>();
  for (const person of people) {
    const list = canonicalByUser.get(person.userId) ?? [];
    list.push(person.canonicalName);
    canonicalByUser.set(person.userId, list);
  }

  const aliasesByKey = new Map<string, string[]>();
  for (const [userId, canonicalNames] of canonicalByUser) {
    const aliasRows = await prisma.entityAlias.findMany({
      where: {
        userId,
        entityType: EntityAliasType.person,
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

  const tagRows = await prisma.personTag.findMany({
    where: { personId: { in: personIds } },
    select: { personId: true, tag: { select: { displayName: true } } }
  });
  const tagsByPersonId = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsByPersonId.get(row.personId) ?? [];
    list.push(row.tag.displayName);
    tagsByPersonId.set(row.personId, list);
  }

  let updated = 0;
  let cleared = 0;
  let failed = 0;

  for (const person of people) {
    const aliases = aliasesByKey.get(`${person.userId}|${person.canonicalName}`) ?? [];
    const tags = tagsByPersonId.get(person.id) ?? [];
    const source = buildSource({
      displayName: person.displayName,
      notes: person.notes,
      aliases,
      tags
    });

    if (!source) {
      await writePersonEmbedding(person.id, null);
      cleared += 1;
      console.log(`[backfill] cleared ${person.displayName} (no source)`);
      continue;
    }

    try {
      const embedding = await generateEmbedding(source);
      await writePersonEmbedding(person.id, embedding);
      updated += 1;
      console.log(`[backfill] embedded ${person.displayName}`);
    } catch (error) {
      failed += 1;
      console.error(`[backfill] failed for ${person.displayName}`, error);
    }
  }

  console.log(
    `[backfill] Done. updated=${updated} cleared=${cleared} failed=${failed} total=${people.length}`
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

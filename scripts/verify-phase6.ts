import { prisma } from "../lib/prisma.ts";
import {
  normalizeEntityList,
  normalizeMetadataList
} from "../lib/entity-normalization.ts";

const TEST_ENTRY_DATE = "2099-12-31";
const TEST_EMAIL = (process.env.OWNER_EMAIL || "").toLowerCase();
const summaryModel = process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini";
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const openAiApiKey = process.env.OPENAI_API_KEY;
const TEST_PROJECT_CANONICAL_NAME = "personal_blog";
const TEST_PERSON_CANONICAL_NAME = "john_doe";
const TEST_RAW_TEXT = [
  "Hoy trabajé en personal blog.",
  "Hablé con John Doe sobre planificación y programación.",
  "Me sentí optimista y enfocado.",
  "Necesito dar seguimiento mañana con los próximos pasos."
].join(" ");

function ensureApiKey() {
  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function formatVectorLiteral(values: number[]) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  if (!values.every((value) => Number.isFinite(value))) {
    throw new Error("Embedding contains non-finite values.");
  }

  return `[${values.join(",")}]`;
}

async function callOpenAi<T>(path: string, body: Record<string, unknown>) {
  ensureApiKey();

  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function analyzeJournal(rawText: string) {
  const analysis = await callOpenAi<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>("chat/completions", {
    model: summaryModel,
    temperature: 0.2,
    response_format: {
      type: "json_object"
    },
    messages: [
      {
        role: "system",
        content:
          "Devuelve JSON estricto con llaves summary, projects, people, topics, tools, events, media, observations, emotions, action_items. Responde en español."
      },
      {
        role: "user",
        content: TEST_RAW_TEXT
      }
    ]
  });

  const content = analysis.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Analysis response was empty.");
  }

  const parsed = JSON.parse(content) as {
    summary?: string;
    projects?: string[];
    people?: string[];
    topics?: string[];
    tools?: string[];
    events?: string[];
    media?: string[];
    observations?: string[];
    emotions?: string[];
    action_items?: string[];
  };

  const embeddingResponse = await callOpenAi<{
    data?: Array<{
      embedding?: number[];
    }>;
  }>("embeddings", {
    model: embeddingModel,
    input: rawText
  });

  const embedding = embeddingResponse.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("Embedding response was empty.");
  }

  return {
    summary: parsed.summary ?? null,
    topics: normalizeMetadataList(parsed.topics ?? [], "topic"),
    tools: normalizeMetadataList(parsed.tools ?? [], "tool"),
    events: normalizeMetadataList(parsed.events ?? [], "event"),
    media: normalizeMetadataList(parsed.media ?? [], "media"),
    observations: normalizeMetadataList(parsed.observations ?? [], "observation"),
    people: normalizeEntityList(parsed.people ?? []),
    projects: normalizeEntityList(parsed.projects ?? []),
    emotions: normalizeMetadataList(parsed.emotions ?? [], "emotion"),
    actionItems: normalizeMetadataList(parsed.action_items ?? [], "action_item"),
    embedding
  };
}

async function setEmbedding(journalEntryId: string, embedding: number[]) {
  const vectorLiteral = formatVectorLiteral(embedding);

  if (!vectorLiteral) {
    return;
  }

  await prisma.$executeRaw`
    UPDATE "journal_entries"
    SET "embedding" = ${vectorLiteral}::extensions.vector(1536)
    WHERE "id" = ${journalEntryId}
  `;
}

async function getEmbeddingDimensions(journalEntryId: string) {
  const result = await prisma.$queryRaw<Array<{ dimensions: number | null }>>`
    SELECT vector_dims("embedding") AS "dimensions"
    FROM "journal_entries"
    WHERE "id" = ${journalEntryId}
    LIMIT 1
  `;

  return result[0]?.dimensions ?? null;
}

async function cleanup(userId: string) {
  await prisma.journalEntry.deleteMany({
    where: {
      userId,
      entryDate: new Date(`${TEST_ENTRY_DATE}T00:00:00.000Z`)
    }
  });

  await prisma.project.deleteMany({
    where: {
      userId,
      canonicalName: {
        in: [TEST_PROJECT_CANONICAL_NAME]
      }
    }
  });

  await prisma.person.deleteMany({
    where: {
      userId,
      canonicalName: {
        in: [TEST_PERSON_CANONICAL_NAME]
      }
    }
  });

}

async function main() {
  if (!TEST_EMAIL) {
    throw new Error("Missing OWNER_EMAIL.");
  }

  const user = await prisma.user.upsert({
    where: {
      email: TEST_EMAIL
    },
    create: {
      email: TEST_EMAIL
    },
    update: {}
  });

  await cleanup(user.id);

  const analysis = await analyzeJournal(TEST_RAW_TEXT);
  const entryDate = new Date(`${TEST_ENTRY_DATE}T00:00:00.000Z`);

  const entry = await prisma.journalEntry.upsert({
    where: {
      userId_entryDate: {
        userId: user.id,
        entryDate
      }
    },
    create: {
      userId: user.id,
      entryDate,
      rawText: TEST_RAW_TEXT,
      summary: analysis.summary,
      topics: analysis.topics,
      tools: analysis.tools,
      events: analysis.events,
      media: analysis.media,
      observations: analysis.observations,
      emotions: analysis.emotions,
      actionItems: analysis.actionItems
    },
    update: {
      rawText: TEST_RAW_TEXT,
      summary: analysis.summary,
      topics: analysis.topics,
      tools: analysis.tools,
      events: analysis.events,
      media: analysis.media,
      observations: analysis.observations,
      emotions: analysis.emotions,
      actionItems: analysis.actionItems
    }
  });

  const [projects, people] = await Promise.all([
    Promise.all(
      analysis.projects.map((value) =>
        prisma.project.upsert({
          where: {
            userId_canonicalName: {
              userId: user.id,
              canonicalName: value.canonicalName
            }
          },
          create: {
            userId: user.id,
            canonicalName: value.canonicalName,
            displayName: value.displayName
          },
          update: {
            displayName: value.displayName
          }
        })
      )
    ),
    Promise.all(
      analysis.people.map((value) =>
        prisma.person.upsert({
          where: {
            userId_canonicalName: {
              userId: user.id,
              canonicalName: value.canonicalName
            }
          },
          create: {
            userId: user.id,
            canonicalName: value.canonicalName,
            displayName: value.displayName
          },
          update: {
            displayName: value.displayName
          }
        })
      )
    )
  ]);

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.journalEntryProject.deleteMany({ where: { journalEntryId: entry.id } }),
      tx.journalEntryPerson.deleteMany({ where: { journalEntryId: entry.id } })
    ]);

    if (projects.length > 0) {
      await tx.journalEntryProject.createMany({
        data: projects.map((project) => ({
          journalEntryId: entry.id,
          projectId: project.id
        })),
        skipDuplicates: true
      });
    }

    if (people.length > 0) {
      await tx.journalEntryPerson.createMany({
        data: people.map((person) => ({
          journalEntryId: entry.id,
          personId: person.id
        })),
        skipDuplicates: true
      });
    }

  });

  await setEmbedding(entry.id, analysis.embedding);

  const dimensions = await getEmbeddingDimensions(entry.id);

  const contextRows = await prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
    SELECT
      "id",
      1 - ("embedding" <=> ${formatVectorLiteral(analysis.embedding)}::extensions.vector(1536)) AS "similarity"
    FROM "journal_entries"
    WHERE "userId" = ${user.id}
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${formatVectorLiteral(analysis.embedding)}::extensions.vector(1536)
    LIMIT 3
  `;

  console.log(
    JSON.stringify(
      {
        savedEntryId: entry.id,
        embeddingDimensions: dimensions,
        projectCanonicalNames: projects.map((item) => item.canonicalName),
        peopleCanonicalNames: people.map((item) => item.canonicalName),
        topics: analysis.topics,
        tools: analysis.tools,
        contextRows
      },
      null,
      2
    )
  );

  await cleanup(user.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

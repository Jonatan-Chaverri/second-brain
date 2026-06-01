import { EntityAliasType, Prisma, UserInsightCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateQueryEmbedding } from "@/lib/openai";
import { normalizeLookupKey } from "@/lib/entity-normalization";
import {
  findPersonCanonicalNamesByTagLabels,
  getPersonDirectoryForCanonicalNames,
  listPersonNameIndexForUser,
  PersonDirectoryEntry
} from "@/lib/people-service";
import { getProjectDirectoryForCanonicalNames, listProjectNameIndexForUser } from "@/lib/projects-service";
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
  const queryEmbedding = await generateQueryEmbedding(input.message, input.userId);
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

export type ChatContextUserInsight = {
  category: UserInsightCategory;
  content: string;
  entryDate: string | null;
};

export type ChatContextUserProfile = {
  birthDate: string | null;
  profession: string | null;
  personalityType: string | null;
  country: string | null;
  city: string | null;
  languages: string | null;
  pronouns: string | null;
  bio: string | null;
  notes: string | null;
};

async function fetchUserProfile(userId: string): Promise<ChatContextUserProfile | null> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  const hasAny =
    profile.birthDate ||
    profile.profession ||
    profile.personalityType ||
    profile.country ||
    profile.city ||
    profile.languages ||
    profile.pronouns ||
    profile.bio ||
    profile.notes;
  if (!hasAny) return null;
  return {
    birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
    profession: profile.profession,
    personalityType: profile.personalityType,
    country: profile.country,
    city: profile.city,
    languages: profile.languages,
    pronouns: profile.pronouns,
    bio: profile.bio,
    notes: profile.notes
  };
}

const INSIGHT_CATEGORY_KEYWORDS: Record<UserInsightCategory, string[]> = {
  insecurity: [
    "inseguridad",
    "inseguridades",
    "inseguro",
    "insegura",
    "insecurity",
    "insecurities"
  ],
  fear: ["miedo", "miedos", "temor", "temores", "fear", "fears", "afraid"],
  achievement: [
    "logro",
    "logros",
    "éxito",
    "éxitos",
    "exito",
    "exitos",
    "achievement",
    "achievements",
    "win",
    "wins"
  ],
  strength: [
    "fortaleza",
    "fortalezas",
    "strength",
    "strengths",
    "virtud",
    "virtudes"
  ],
  weakness: [
    "debilidad",
    "debilidades",
    "weakness",
    "weaknesses",
    "defecto",
    "defectos"
  ],
  value: ["valor", "valores", "value", "values", "principio", "principios"],
  belief: [
    "creencia",
    "creencias",
    "belief",
    "beliefs",
    "convicción",
    "conviccion",
    "convicciones"
  ],
  goal: ["meta", "metas", "objetivo", "objetivos", "goal", "goals"],
  dream: [
    "sueño",
    "sueno",
    "sueños",
    "suenos",
    "aspiración",
    "aspiracion",
    "aspiraciones",
    "dream",
    "dreams"
  ],
  preference: [
    "preferencia",
    "preferencias",
    "gusto",
    "gustos",
    "preference",
    "preferences"
  ],
  relationship_pattern: [
    "relación",
    "relacion",
    "relaciones",
    "vínculo",
    "vinculo",
    "vínculos",
    "vinculos",
    "relationship",
    "relationships"
  ],
  habit: ["hábito", "habito", "hábitos", "habitos", "habit", "habits", "rutina", "rutinas"],
  other: []
};

export function detectInsightCategoriesInMessage(message: string): UserInsightCategory[] {
  const normalized = ` ${normalizeLookupKey(message)} `;
  if (normalized.trim().length === 0) {
    return [];
  }

  const matches = new Set<UserInsightCategory>();
  for (const [category, keywords] of Object.entries(INSIGHT_CATEGORY_KEYWORDS) as Array<
    [UserInsightCategory, string[]]
  >) {
    for (const keyword of keywords) {
      const needle = normalizeLookupKey(keyword);
      if (needle && normalized.includes(` ${needle} `)) {
        matches.add(category);
        break;
      }
    }
  }
  return Array.from(matches);
}

async function fetchUserInsights(
  userId: string,
  categories: UserInsightCategory[]
): Promise<ChatContextUserInsight[]> {
  if (categories.length === 0) return [];

  const rows = await prisma.userInsight.findMany({
    where: { userId, category: { in: categories } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      journalEntry: { select: { entryDate: true } }
    }
  });

  return rows.map((row) => ({
    category: row.category,
    content: row.content,
    entryDate: row.journalEntry?.entryDate.toISOString().slice(0, 10) ?? null
  }));
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

  const personNameIndex = await listPersonNameIndexForUser(input.userId);

  const PEOPLE_DIRECTORY_LIMIT = 8;
  const PEOPLE_MIN_SIMILARITY = 0.3;

  const peopleCanonicalNames = new Set<string>([
    ...referencedCanonicalNames,
    ...messageMentionedCanonicalNames,
    ...tagMentionedCanonicalNames
  ]);

  if (
    personNameIndex.length > 0 &&
    peopleCanonicalNames.size < PEOPLE_DIRECTORY_LIMIT
  ) {
    const relevantPeople = await findRelevantPersonCanonicalNames({
      userId: input.userId,
      message: input.message,
      limit: PEOPLE_DIRECTORY_LIMIT,
      minSimilarity: PEOPLE_MIN_SIMILARITY
    });
    for (const name of relevantPeople) {
      if (peopleCanonicalNames.size >= PEOPLE_DIRECTORY_LIMIT) break;
      peopleCanonicalNames.add(name);
    }
  }

  const cappedPeopleCanonicalNames = Array.from(peopleCanonicalNames).slice(
    0,
    PEOPLE_DIRECTORY_LIMIT
  );

  const peopleDirectory = await getPersonDirectoryForCanonicalNames(
    input.userId,
    cappedPeopleCanonicalNames
  );

  const matchedInsightCategories = detectInsightCategoriesInMessage(input.message);
  const userInsights = await fetchUserInsights(input.userId, matchedInsightCategories);
  const userProfile = await fetchUserProfile(input.userId);

  const projectNameIndex = await listProjectNameIndexForUser(input.userId);

  const PROJECT_DIRECTORY_LIMIT = 5;
  const PROJECT_MIN_SIMILARITY = 0.3;

  const projectCanonicalNames = new Set<string>();

  if (projectNameIndex.length > 0) {
    const mentioned = await findProjectCanonicalNamesMentionedInMessage(
      input.userId,
      input.message
    );
    for (const name of mentioned) projectCanonicalNames.add(name);

    const taggedProjects = await findProjectCanonicalNamesByTagMentions(
      input.userId,
      input.message
    );
    for (const name of taggedProjects) projectCanonicalNames.add(name);

    const entryLinkedProjects = await getProjectCanonicalNamesForEntries(
      entries.map((entry) => entry.entryId)
    );
    for (const name of entryLinkedProjects) projectCanonicalNames.add(name);

    if (projectCanonicalNames.size < PROJECT_DIRECTORY_LIMIT) {
      const relevant = await findRelevantProjectCanonicalNames({
        userId: input.userId,
        message: input.message,
        limit: PROJECT_DIRECTORY_LIMIT,
        minSimilarity: PROJECT_MIN_SIMILARITY
      });
      for (const name of relevant) {
        if (projectCanonicalNames.size >= PROJECT_DIRECTORY_LIMIT) break;
        projectCanonicalNames.add(name);
      }
    }
  }

  const cappedProjectCanonicalNames = Array.from(projectCanonicalNames).slice(
    0,
    PROJECT_DIRECTORY_LIMIT
  );
  const projectDirectory = await getProjectDirectoryForCanonicalNames(
    input.userId,
    cappedProjectCanonicalNames
  );

  return {
    entries,
    peopleDirectory,
    personNameIndex,
    projectDirectory,
    projectNameIndex,
    userInsights,
    userProfile,
    hasEnoughContext:
      entries.length > 0 ||
      peopleDirectory.length > 0 ||
      personNameIndex.length > 0 ||
      projectDirectory.length > 0 ||
      projectNameIndex.length > 0 ||
      userInsights.length > 0 ||
      userProfile !== null
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
    where: { userId, scope: "person" },
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

async function findProjectCanonicalNamesMentionedInMessage(
  userId: string,
  message: string
): Promise<string[]> {
  const normalizedMessage = ` ${normalizeLookupKey(message)} `;

  if (normalizedMessage.trim().length === 0) {
    return [];
  }

  const [projects, aliases] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      select: { canonicalName: true, displayName: true }
    }),
    prisma.entityAlias.findMany({
      where: { userId, entityType: EntityAliasType.project },
      select: { alias: true, canonicalName: true }
    })
  ]);

  const matches = new Set<string>();

  for (const project of projects) {
    const needle = normalizeLookupKey(project.displayName);
    if (needle && normalizedMessage.includes(` ${needle} `)) {
      matches.add(project.canonicalName);
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

async function findProjectCanonicalNamesByTagMentions(
  userId: string,
  message: string
): Promise<string[]> {
  const normalizedMessage = ` ${normalizeLookupKey(message)} `;

  if (normalizedMessage.trim().length === 0) {
    return [];
  }

  const tags = await prisma.tag.findMany({
    where: { userId, scope: "project" },
    select: { id: true, displayName: true }
  });

  const matchedTagIds: string[] = [];
  for (const tag of tags) {
    const needle = normalizeLookupKey(tag.displayName);
    if (needle && normalizedMessage.includes(` ${needle} `)) {
      matchedTagIds.push(tag.id);
    }
  }

  if (matchedTagIds.length === 0) return [];

  const rows = await prisma.project.findMany({
    where: {
      userId,
      tags: { some: { tagId: { in: matchedTagIds } } }
    },
    select: { canonicalName: true }
  });

  return Array.from(new Set(rows.map((row) => row.canonicalName)));
}

async function getProjectCanonicalNamesForEntries(entryIds: string[]): Promise<string[]> {
  if (entryIds.length === 0) return [];

  const rows = await prisma.journalEntryProject.findMany({
    where: { journalEntryId: { in: entryIds } },
    select: { project: { select: { canonicalName: true } } }
  });

  return Array.from(new Set(rows.map((row) => row.project.canonicalName)));
}

type SimilarPersonRow = {
  canonicalName: string;
  similarity: number;
};

async function findRelevantPersonCanonicalNames(input: {
  userId: string;
  message: string;
  limit: number;
  minSimilarity: number;
}): Promise<string[]> {
  const queryEmbedding = await generateQueryEmbedding(input.message, input.userId);
  const vectorLiteral = formatVectorLiteral(queryEmbedding);
  if (!vectorLiteral) return [];

  const rows = await prisma.$queryRaw<SimilarPersonRow[]>`
    SELECT
      "canonicalName",
      1 - ("embedding" <=> ${vectorLiteral}::extensions.vector(1536)) AS "similarity"
    FROM "people"
    WHERE "userId" = ${input.userId}
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vectorLiteral}::extensions.vector(1536)
    LIMIT ${input.limit}
  `;

  return rows
    .filter((row) => row.similarity >= input.minSimilarity)
    .map((row) => row.canonicalName);
}

type SimilarProjectRow = {
  canonicalName: string;
  similarity: number;
};

async function findRelevantProjectCanonicalNames(input: {
  userId: string;
  message: string;
  limit: number;
  minSimilarity: number;
}): Promise<string[]> {
  const queryEmbedding = await generateQueryEmbedding(input.message, input.userId);
  const vectorLiteral = formatVectorLiteral(queryEmbedding);
  if (!vectorLiteral) return [];

  const rows = await prisma.$queryRaw<SimilarProjectRow[]>`
    SELECT
      "canonicalName",
      1 - ("embedding" <=> ${vectorLiteral}::extensions.vector(1536)) AS "similarity"
    FROM "projects"
    WHERE "userId" = ${input.userId}
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vectorLiteral}::extensions.vector(1536)
    LIMIT ${input.limit}
  `;

  return rows
    .filter((row) => row.similarity >= input.minSimilarity)
    .map((row) => row.canonicalName);
}

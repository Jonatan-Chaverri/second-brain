import { EntityAliasType } from "@prisma/client";

import { resolveEntityAliases } from "@/lib/entity-alias-service";
import { prisma } from "@/lib/prisma";
import {
  journalEntryWithRelationsInclude,
  normalizeEntryDate,
  serializeJournalEntry
} from "@/lib/journal-entry";
import { analyzeJournalEntry } from "@/lib/openai";
import { normalizeMetadataList } from "@/lib/entity-normalization";
import {
  replaceJournalEntryEntityJoins,
  upsertJournalEntities
} from "@/lib/entity-service";
import {
  getJournalEntryEmbeddingDimensions,
  setJournalEntryEmbedding
} from "@/lib/vector";

async function resolveMetadataValues(
  userId: string,
  entityType: EntityAliasType,
  values: string[]
) {
  const resolvedValues = await resolveEntityAliases(userId, entityType, values);

  return Array.from(new Set(resolvedValues.map((value) => value.canonicalName)));
}

export async function saveJournalEntryForUser(input: {
  userId: string;
  rawText: string;
  entryDate?: string;
}) {
  const rawText = input.rawText.trim();
  const entryDate = normalizeEntryDate(input.entryDate);
  const analysis = await analyzeJournalEntry(rawText, input.userId);
  const [
    normalizedProjects,
    normalizedPeople,
    normalizedTopics,
    normalizedTools,
    normalizedEvents,
    normalizedMedia,
    normalizedObservations,
    normalizedEmotions
  ] = await Promise.all([
    resolveEntityAliases(input.userId, EntityAliasType.project, analysis.projects),
    resolveEntityAliases(input.userId, EntityAliasType.person, analysis.people),
    resolveMetadataValues(input.userId, EntityAliasType.topic, analysis.topics),
    resolveMetadataValues(input.userId, EntityAliasType.tool, analysis.tools),
    resolveMetadataValues(input.userId, EntityAliasType.event, analysis.events),
    resolveMetadataValues(input.userId, EntityAliasType.media, analysis.media),
    resolveMetadataValues(input.userId, EntityAliasType.observation, analysis.observations),
    resolveMetadataValues(input.userId, EntityAliasType.emotion, analysis.emotions)
  ]);
  const normalizedActionItems = normalizeMetadataList(analysis.actionItems, "action_item");
  const normalizedLessons = analysis.lessons;
  const normalizedIdeas = analysis.ideas;
  const normalizedExperiences = analysis.experiences;
  const normalizedWorkKnowledge = analysis.workKnowledge;

  const entry = await prisma.$transaction(async (tx) => {
    const savedEntry = await tx.journalEntry.upsert({
      where: {
        userId_entryDate: {
          userId: input.userId,
          entryDate
        }
      },
      create: {
        userId: input.userId,
        entryDate,
        rawText,
        summary: analysis.summary,
        topics: normalizedTopics,
        tools: normalizedTools,
        events: normalizedEvents,
        media: normalizedMedia,
        observations: normalizedObservations,
        emotions: normalizedEmotions,
        actionItems: normalizedActionItems,
        lessons: normalizedLessons,
        ideas: normalizedIdeas,
        experiences: normalizedExperiences,
        workKnowledge: normalizedWorkKnowledge
      },
      update: {
        rawText,
        summary: analysis.summary,
        topics: normalizedTopics,
        tools: normalizedTools,
        events: normalizedEvents,
        media: normalizedMedia,
        observations: normalizedObservations,
        emotions: normalizedEmotions,
        actionItems: normalizedActionItems,
        lessons: normalizedLessons,
        ideas: normalizedIdeas,
        experiences: normalizedExperiences,
        workKnowledge: normalizedWorkKnowledge
      }
    });

    const entities = await upsertJournalEntities(
      input.userId,
      {
        projects: normalizedProjects,
        people: normalizedPeople
      },
      tx
    );

    await replaceJournalEntryEntityJoins(
      savedEntry.id,
      {
        projectIds: entities.projects.map((item) => item.id),
        personIds: entities.people.map((item) => item.id)
      },
      tx
    );

    await setJournalEntryEmbedding(savedEntry.id, analysis.embedding, tx);

    await tx.userInsight.deleteMany({ where: { journalEntryId: savedEntry.id } });
    if (analysis.selfInsights.length > 0) {
      await tx.userInsight.createMany({
        data: analysis.selfInsights.map((insight) => ({
          userId: input.userId,
          journalEntryId: savedEntry.id,
          category: insight.category,
          content: insight.content
        }))
      });
    }

    return tx.journalEntry.findUniqueOrThrow({
      where: { id: savedEntry.id },
      include: journalEntryWithRelationsInclude
    });
  });

  const embeddingDimensions = await getJournalEntryEmbeddingDimensions(entry.id);

  return {
    entry: serializeJournalEntry(entry, { embeddingDimensions })
  };
}

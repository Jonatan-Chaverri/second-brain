import { z } from "zod";
import { serverEnv } from "@/lib/env";

const analysisSchema = z.object({
  summary: z.string().trim().max(1500),
  topics: z.array(z.string().trim().min(1).max(120)).max(12),
  people: z.array(z.string().trim().min(1).max(120)).max(12),
  projects: z.array(z.string().trim().min(1).max(120)).max(12),
  emotions: z.array(z.string().trim().min(1).max(120)).max(12),
  action_items: z.array(z.string().trim().min(1).max(240)).max(12)
});

export type JournalAnalysis = {
  summary: string | null;
  topics: string[];
  people: string[];
  projects: string[];
  emotions: string[];
  actionItems: string[];
  embedding: number[];
};

export class OpenAiProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAiProcessingError";
  }
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function callOpenAi<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.openAiApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new OpenAiProcessingError(`OpenAI request failed: ${response.status} ${details}`);
  }

  return (await response.json()) as T;
}

async function summarizeJournalEntry(rawText: string) {
  const payload = await callOpenAi<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>("chat/completions", {
    model: serverEnv.openAiSummaryModel,
    temperature: 0.2,
    response_format: {
      type: "json_object"
    },
    messages: [
      {
        role: "system",
        content:
          "You extract structured journal data. Return strict JSON with keys summary, topics, people, projects, emotions, action_items. Use concise, literal wording grounded only in the provided text."
      },
      {
        role: "user",
        content: `Analyze this journal entry and extract structured data.\n\nJournal entry:\n${rawText}`
      }
    ]
  });

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new OpenAiProcessingError("OpenAI summary response was empty.");
  }

  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw new OpenAiProcessingError("OpenAI summary response was not valid JSON.");
  }

  const parsed = analysisSchema.safeParse(parsedContent);

  if (!parsed.success) {
    throw new OpenAiProcessingError("OpenAI summary response did not match the expected schema.");
  }

  return {
    summary: parsed.data.summary.trim() || null,
    topics: dedupeStrings(parsed.data.topics),
    people: dedupeStrings(parsed.data.people),
    projects: dedupeStrings(parsed.data.projects),
    emotions: dedupeStrings(parsed.data.emotions),
    actionItems: dedupeStrings(parsed.data.action_items)
  };
}

async function generateEmbedding(rawText: string) {
  const payload = await callOpenAi<{
    data?: Array<{
      embedding?: number[];
    }>;
  }>("embeddings", {
    model: serverEnv.openAiEmbeddingModel,
    input: rawText
  });

  const embedding = payload.data?.[0]?.embedding;

  if (!embedding || !Array.isArray(embedding)) {
    throw new OpenAiProcessingError("OpenAI embedding response was empty.");
  }

  return embedding;
}

export async function analyzeJournalEntry(rawText: string): Promise<JournalAnalysis> {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      summary: null,
      topics: [],
      people: [],
      projects: [],
      emotions: [],
      actionItems: [],
      embedding: []
    };
  }

  const [analysis, embedding] = await Promise.all([
    summarizeJournalEntry(trimmed),
    generateEmbedding(trimmed)
  ]);

  return {
    ...analysis,
    embedding
  };
}

import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { normalizeMetadataList } from "@/lib/entity-normalization";

const analysisSchema = z.object({
  summary: z.string().trim().max(1500),
  projects: z.array(z.string().trim().min(1).max(120)).max(12),
  people: z.array(z.string().trim().min(1).max(120)).max(12),
  topics: z.array(z.string().trim().min(1).max(120)).max(12),
  tools: z.array(z.string().trim().min(1).max(120)).max(12),
  events: z.array(z.string().trim().min(1).max(120)).max(12),
  media: z.array(z.string().trim().min(1).max(120)).max(12),
  observations: z.array(z.string().trim().min(1).max(120)).max(12),
  emotions: z.array(z.string().trim().min(1).max(120)).max(12),
  action_items: z.array(z.string().trim().min(1).max(240)).max(12),
  lessons: z.array(z.string().trim().min(1).max(240)).max(12),
  ideas: z.array(z.string().trim().min(1).max(240)).max(12),
  experiences: z.array(z.string().trim().min(1).max(240)).max(12),
  work_knowledge: z.array(z.string().trim().min(1).max(240)).max(12)
});

export type JournalAnalysis = {
  summary: string | null;
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
    temperature: 0.15,
    response_format: {
      type: "json_object"
    },
    messages: [
      {
        role: "system",
        content:
          [
            "Analiza entradas de diario personales.",
            "Preserva el idioma principal de la entrada en el resumen y la metadata.",
            "Si la entrada está en español, responde en español. Si está en inglés, responde en inglés.",
            "Devuelve JSON estricto con estas llaves: summary, projects, people, topics, tools, events, media, observations, emotions, action_items, lessons, ideas, experiences, work_knowledge.",
            "summary debe ser una sola oración breve y concisa en el mismo idioma de la entrada.",
            "projects y people contienen entidades principales mencionadas en la entrada.",
            "topics solo debe contener temas abstractos de alto valor, por ejemplo: trabajo, programacion, planificacion, aprendizaje o salud.",
            "tools contiene herramientas, plataformas o software.",
            "events contiene sucesos concretos o incidentes.",
            "media contiene películas, series, canciones, libros u otras obras.",
            "observations contiene detalles circunstanciales o del entorno.",
            "lessons contiene aprendizajes, lecciones, errores, realizaciones o principios importantes extraídos de la entrada.",
            "ideas contiene ideas nuevas, posibilidades futuras, conceptos creativos, de producto, negocio o técnicas mencionadas en la entrada.",
            "experiences contiene experiencias personales o profesionales notables descritas en la entrada.",
            "work_knowledge contiene conocimiento específico de trabajo, hallazgos técnicos, debugging, comportamiento del sistema, detalles de proceso o conocimiento de dominio aprendido en la entrada.",
            "No mezcles herramientas, medios, observaciones o eventos dentro de topics.",
            "Evita duplicados y variantes del mismo concepto.",
            "Prefiere nombres canónicos y concisos.",
            "No traduzcas la entrada a otro idioma a menos que sea estrictamente necesario.",
            "No inventes entidades que no estén respaldadas por el texto."
          ].join(" ")
      },
      {
        role: "user",
        content: `Analiza esta entrada de diario y clasifica correctamente la metadata.\n\nEntrada:\n${rawText}`
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
    projects: dedupeStrings(parsed.data.projects),
    people: dedupeStrings(parsed.data.people),
    topics: normalizeMetadataList(parsed.data.topics, "topic"),
    tools: normalizeMetadataList(parsed.data.tools, "tool"),
    events: normalizeMetadataList(parsed.data.events, "event"),
    media: normalizeMetadataList(parsed.data.media, "media"),
    observations: normalizeMetadataList(parsed.data.observations, "observation"),
    emotions: normalizeMetadataList(parsed.data.emotions, "emotion"),
    actionItems: normalizeMetadataList(parsed.data.action_items, "action_item"),
    lessons: dedupeStrings(parsed.data.lessons),
    ideas: dedupeStrings(parsed.data.ideas),
    experiences: dedupeStrings(parsed.data.experiences),
    workKnowledge: dedupeStrings(parsed.data.work_knowledge)
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

type ChatAnswerInput = {
  message: string;
  contextBlocks: Array<{
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
  }>;
};

export async function analyzeJournalEntry(rawText: string): Promise<JournalAnalysis> {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      summary: null,
      projects: [],
      people: [],
      topics: [],
      tools: [],
      events: [],
      media: [],
      observations: [],
      emotions: [],
      actionItems: [],
      lessons: [],
      ideas: [],
      experiences: [],
      workKnowledge: [],
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

export async function generateQueryEmbedding(message: string) {
  const trimmed = message.trim();

  if (!trimmed) {
    return [];
  }

  return generateEmbedding(trimmed);
}

export async function answerJournalQuestion(input: ChatAnswerInput) {
  const trimmedMessage = input.message.trim();

  if (!trimmedMessage) {
    throw new OpenAiProcessingError("Chat message was empty.");
  }

  const contextText =
    input.contextBlocks.length > 0
      ? input.contextBlocks
          .map((block, index) =>
            [
              `Entrada ${index + 1}`,
              `Fecha: ${block.entryDate}`,
              `Resumen: ${block.summary ?? "Ninguno"}`,
              `Proyectos: ${block.projects.join(", ") || "Ninguno"}`,
              `Personas: ${block.people.join(", ") || "Ninguna"}`,
              `Temas: ${block.topics.join(", ") || "Ninguno"}`,
              `Herramientas: ${block.tools.join(", ") || "Ninguna"}`,
              `Eventos: ${block.events.join(", ") || "Ninguno"}`,
              `Media: ${block.media.join(", ") || "Ninguna"}`,
              `Observaciones: ${block.observations.join(", ") || "Ninguna"}`,
              `Emociones: ${block.emotions.join(", ") || "Ninguna"}`,
              `Acciones: ${block.actionItems.join(", ") || "Ninguna"}`,
              `Lecciones: ${block.lessons.join(", ") || "Ninguna"}`,
              `Ideas: ${block.ideas.join(", ") || "Ninguna"}`,
              `Experiencias: ${block.experiences.join(", ") || "Ninguna"}`,
              `Conocimiento de trabajo: ${block.workKnowledge.join(", ") || "Ninguno"}`,
              `Texto: ${block.rawText}`
            ].join("\n")
          )
          .join("\n\n")
      : "No se encontró contexto relevante en el diario.";

  const payload = await callOpenAi<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>("chat/completions", {
    model: serverEnv.openAiSummaryModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Responde siempre en español usando solo el contexto del diario proporcionado. No inventes detalles. Si el contexto es insuficiente, dilo claramente. Menciona fechas cuando estén disponibles."
      },
      {
        role: "user",
        content: `Pregunta:\n${trimmedMessage}\n\nContexto del diario:\n${contextText}`
      }
    ]
  });

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new OpenAiProcessingError("OpenAI chat response was empty.");
  }

  return content;
}

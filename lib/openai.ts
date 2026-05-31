import { z } from "zod";
import { serverEnv } from "@/lib/env";
import {
  normalizeLookupKey,
  normalizeMetadataList
} from "@/lib/entity-normalization";

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

function includesNormalizedPhrase(haystack: string, needle: string) {
  const normalizedHaystack = normalizeLookupKey(haystack);
  const normalizedNeedle = normalizeLookupKey(needle);

  if (!normalizedHaystack || !normalizedNeedle) {
    return false;
  }

  return ` ${normalizedHaystack} `.includes(` ${normalizedNeedle} `);
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
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  browserContext?: {
    localDate: string;
    localTime: string;
    timeZone: string;
    utcOffset: string;
  };
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
    similarity?: number;
  }>;
};

function buildJournalChatMessages(input: ChatAnswerInput) {
  const trimmedMessage = input.message.trim();

  if (!trimmedMessage) {
    throw new OpenAiProcessingError("Chat message was empty.");
  }

  // Token-saving rules:
  // - Only include rawText for highly relevant blocks (or when no summary exists).
  // - Always include rawText when the user explicitly asks about a tracked person/project
  //   present in the block, otherwise we can lose relationship details like
  //   "Valeria es mi novia".
  // - Skip empty metadata lines entirely.
  // - Mark blocks with a similarity score so we can decide what to expand.
  const RAW_TEXT_SIMILARITY_THRESHOLD = 0.6;

  function formatList(label: string, values: string[]) {
    if (values.length === 0) return null;
    return `${label}: ${values.join(", ")}`;
  }

  const contextText =
    input.contextBlocks.length > 0
      ? input.contextBlocks
          .map((block, index) => {
            const similarity = block.similarity ?? 0;
            const mentionsTrackedEntity = [...block.people, ...block.projects].some((value) =>
              includesNormalizedPhrase(trimmedMessage, value)
            );
            const includeRawText =
              !block.summary ||
              similarity >= RAW_TEXT_SIMILARITY_THRESHOLD ||
              mentionsTrackedEntity;

            const lines: Array<string | null> = [
              `Entrada ${index + 1} (fecha: ${block.entryDate})`,
              block.summary ? `Resumen: ${block.summary}` : null,
              formatList("Proyectos", block.projects),
              formatList("Personas", block.people),
              formatList("Temas", block.topics),
              formatList("Herramientas", block.tools),
              formatList("Eventos", block.events),
              formatList("Media", block.media),
              formatList("Observaciones", block.observations),
              formatList("Emociones", block.emotions),
              formatList("Acciones", block.actionItems),
              formatList("Lecciones", block.lessons),
              formatList("Ideas", block.ideas),
              formatList("Experiencias", block.experiences),
              formatList("Conocimiento de trabajo", block.workKnowledge),
              includeRawText ? `Texto: ${block.rawText}` : null
            ];

            return lines.filter((line): line is string => line !== null).join("\n");
          })
          .join("\n\n")
      : "";

  const hasContext = input.contextBlocks.length > 0;
  const browserTimeContext = input.browserContext
    ? `Fecha local del usuario: ${input.browserContext.localDate} ${input.browserContext.localTime} (zona horaria ${input.browserContext.timeZone}, UTC${input.browserContext.utcOffset})`
    : null;

  const systemPrompt = [
    'Eres el asistente personal de un diario privado ("segundo cerebro").',
    "Cuando el usuario pregunte por hoy, ayer, mañana o esta semana, usa la fecha local del usuario proporcionada en el contexto temporal; no asumas UTC ni hora del servidor.",
    "Si el usuario hace una pregunta sobre su vida, trabajo, proyectos, personas o cualquier cosa que esté o pueda estar en el diario, usa únicamente el contexto del diario proporcionado y menciona fechas cuando estén disponibles. No inventes detalles. Si el contexto es insuficiente, dilo claramente.",
    'Si el usuario solo saluda ("hola", "qué tal"), agradece, hace charla casual, o pregunta sobre ti o tus capacidades, responde de forma natural y breve sin mencionar el diario salvo que pregunte por él. NO resumas ni listes entradas del diario en respuestas casuales.',
    "Si no se proporciona contexto del diario, asume que la pregunta no requiere consultar el diario y responde de forma conversacional.",
    "Responde siempre en español. Mantén coherencia con los turnos previos de la conversación."
  ].join(" ");

  const userContent = hasContext
    ? `${browserTimeContext ? `Contexto temporal:\n${browserTimeContext}\n\n` : ""}Pregunta:\n${trimmedMessage}\n\nContexto del diario:\n${contextText}`
    : `${browserTimeContext ? `Contexto temporal:\n${browserTimeContext}\n\n` : ""}Pregunta:\n${trimmedMessage}\n\n(No se recuperó contexto relevante del diario para esta pregunta.)`;

  // Cap history to the last 6 turns (3 user/assistant pairs) to keep tokens low.
  const HISTORY_TURN_LIMIT = 6;
  const historyMessages = (input.history ?? [])
    .filter((turn) => turn.content.trim().length > 0)
    .slice(-HISTORY_TURN_LIMIT)
    .map((turn) => ({ role: turn.role, content: turn.content }));

  return [
    {
      role: "system",
      content: systemPrompt
    },
    ...historyMessages,
    {
      role: "user",
      content: userContent
    }
  ];
}

async function createOpenAiChatTextStream(messages: Array<{ role: string; content: string }>) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.openAiApiKey}`
    },
    body: JSON.stringify({
      model: serverEnv.openAiSummaryModel,
      temperature: 0.2,
      stream: true,
      messages
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new OpenAiProcessingError(`OpenAI request failed: ${response.status} ${details}`);
  }

  if (!response.body) {
    throw new OpenAiProcessingError("OpenAI stream response was empty.");
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line || !line.startsWith("data:")) {
              continue;
            }

            const payload = line.slice(5).trim();

            if (payload === "[DONE]") {
              controller.close();
              return;
            }

            let parsed: {
              choices?: Array<{
                delta?: {
                  content?: string;
                };
              }>;
            };

            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }

            const chunk = parsed.choices?.[0]?.delta?.content;

            if (chunk) {
              controller.enqueue(encoder.encode(chunk));
            }
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });
}

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
  const messages = buildJournalChatMessages(input);

  const payload = await callOpenAi<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>("chat/completions", {
    model: serverEnv.openAiSummaryModel,
    temperature: 0.2,
    messages
  });

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new OpenAiProcessingError("OpenAI chat response was empty.");
  }

  return content;
}

export async function streamJournalQuestion(input: ChatAnswerInput) {
  const messages = buildJournalChatMessages(input);
  return createOpenAiChatTextStream(messages);
}

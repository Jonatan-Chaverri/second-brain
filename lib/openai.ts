import { z } from "zod";
import { UserInsightCategory } from "@prisma/client";
import { serverEnv } from "@/lib/env";
import {
  normalizeLookupKey,
  normalizeMetadataList
} from "@/lib/entity-normalization";
import { recordAiUsage } from "@/lib/ai-usage-service";

type OpenAiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type TrackedResponseEnvelope = {
  usage?: OpenAiUsage;
  model?: string;
};

const insightCategories = Object.values(UserInsightCategory) as [
  UserInsightCategory,
  ...UserInsightCategory[]
];

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
  work_knowledge: z.array(z.string().trim().min(1).max(240)).max(12),
  self_insights: z
    .array(
      z.object({
        category: z.enum(insightCategories),
        content: z.string().trim().min(1).max(300)
      })
    )
    .max(10)
    .optional()
    .default([])
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
  selfInsights: Array<{ category: UserInsightCategory; content: string }>;
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

async function callOpenAi<T>(
  path: string,
  body: Record<string, unknown>,
  tracking?: { userId?: string; model: string }
) {
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

  const json = (await response.json()) as T & TrackedResponseEnvelope;

  if (tracking?.userId) {
    await recordAiUsage({
      userId: tracking.userId,
      model: json.model ?? tracking.model,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0
    });
  }

  return json;
}

async function summarizeJournalEntry(rawText: string, userId?: string) {
  const payload = await callOpenAi<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>(
    "chat/completions",
    {
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
            "Devuelve JSON estricto con estas llaves: summary, projects, people, topics, tools, events, media, observations, emotions, action_items, lessons, ideas, experiences, work_knowledge, self_insights.",
            "summary debe ser una sola oración breve y concisa en el mismo idioma de la entrada.",
            "projects y people contienen entidades principales mencionadas en la entrada.",
            "people SOLO debe contener individuos identificables y reales: nombres propios (Juan, María, Pedro Rojas), apodos personales del autor (mamá, papá, mi hermano, mi novia), o referencias específicas a una persona conocida del autor. NUNCA incluyas descripciones genéricas, hipotéticas, arquetipos o grupos: 'una chica guapa', 'un mae alto', 'un tipo', 'la gente', 'alguien', 'mujeres', 'hombres', 'un compañero de trabajo', 'el jefe', 'el cliente' no son personas. Si la entrada no nombra a un individuo concreto, deja people vacío.",
            "Lo mismo para projects: solo proyectos con nombre concreto del autor; no incluyas categorías genéricas como 'mi proyecto' o 'el trabajo'.",
            "topics solo debe contener temas abstractos de alto valor, por ejemplo: trabajo, programacion, planificacion, aprendizaje o salud.",
            "tools contiene herramientas, plataformas o software.",
            "events contiene sucesos concretos o incidentes.",
            "media contiene películas, series, canciones, libros u otras obras.",
            "observations contiene detalles circunstanciales o del entorno.",
            "lessons contiene aprendizajes, lecciones, errores, realizaciones o principios importantes extraídos de la entrada.",
            "ideas contiene ideas nuevas, posibilidades futuras, conceptos creativos, de producto, negocio o técnicas mencionadas en la entrada.",
            "experiences contiene experiencias personales o profesionales notables descritas en la entrada.",
            "work_knowledge contiene conocimiento específico de trabajo, hallazgos técnicos, debugging, comportamiento del sistema, detalles de proceso o conocimiento de dominio aprendido en la entrada.",
            "self_insights es una lista de afirmaciones de auto-conocimiento del autor extraídas de la entrada. Cada elemento es {category, content}. Solo incluye aquellas que el autor expresa sobre sí mismo de forma clara (no sobre otras personas).",
            "category debe ser una de: insecurity (inseguridades, dudas sobre uno mismo), fear (miedos), achievement (logros propios), strength (fortalezas), weakness (debilidades), value (valores), belief (creencias personales), goal (metas), dream (sueños o aspiraciones), preference (preferencias personales), relationship_pattern (patrones en sus relaciones), habit (hábitos), other.",
            "content debe ser una oración breve en primera o tercera persona neutra que capture el insight (por ejemplo: 'Se siente realizado al trabajar en sus proyectos').",
            "Solo emite self_insights cuando el texto contenga material introspectivo explícito. Si no hay, devuelve [] .",
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
    },
    { userId, model: serverEnv.openAiSummaryModel }
  );

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
    workKnowledge: dedupeStrings(parsed.data.work_knowledge),
    selfInsights: (parsed.data.self_insights ?? [])
      .map((insight) => ({
        category: insight.category,
        content: insight.content.trim()
      }))
      .filter((insight) => insight.content.length > 0)
  };
}

async function generateEmbedding(rawText: string, userId?: string) {
  const payload = await callOpenAi<{
    data?: Array<{
      embedding?: number[];
    }>;
  }>(
    "embeddings",
    {
      model: serverEnv.openAiEmbeddingModel,
      input: rawText
    },
    { userId, model: serverEnv.openAiEmbeddingModel }
  );

  const embedding = payload.data?.[0]?.embedding;

  if (!embedding || !Array.isArray(embedding)) {
    throw new OpenAiProcessingError("OpenAI embedding response was empty.");
  }

  return embedding;
}

type ChatAnswerInput = {
  message: string;
  userId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  browserContext?: {
    localDate: string;
    localTime: string;
    timeZone: string;
    utcOffset: string;
  };
  peopleDirectory?: Array<{
    displayName: string;
    notes: string | null;
    birthday: string | null;
    aliases: string[];
    tags: string[];
  }>;
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
  userInsights?: Array<{
    category: UserInsightCategory;
    content: string;
    entryDate: string | null;
  }>;
  userProfile?: {
    birthDate: string | null;
    profession: string | null;
    personalityType: string | null;
    country: string | null;
    city: string | null;
    languages: string | null;
    pronouns: string | null;
    bio: string | null;
    notes: string | null;
  } | null;
};

function buildJournalChatMessages(input: ChatAnswerInput) {
  const trimmedMessage = input.message.trim();

  if (!trimmedMessage) {
    throw new OpenAiProcessingError("Chat message was empty.");
  }

  // Token-saving rules:
  // - Only include rawText for highly relevant blocks (or when no summary exists).
  // - Always include rawText when the user explicitly asks about a tracked person/project
  //   present in the block, otherwise we can lose relationship details (e.g. how this
  //   person relates to the author).
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

  const peopleDirectoryText =
    input.peopleDirectory && input.peopleDirectory.length > 0
      ? input.peopleDirectory
          .map((person) => {
            const lines: Array<string | null> = [
              `- ${person.displayName}`,
              person.aliases.length > 0 ? `  Alias: ${person.aliases.join(", ")}` : null,
              person.tags.length > 0 ? `  Tags: ${person.tags.join(", ")}` : null,
              person.birthday ? `  Cumpleaños: ${person.birthday}` : null,
              person.notes ? `  Notas: ${person.notes}` : null
            ];
            return lines.filter((line): line is string => line !== null).join("\n");
          })
          .join("\n")
      : null;

  const systemPrompt = [
    'Eres el asistente personal de un diario privado ("segundo cerebro").',
    "Cuando el usuario pregunte por hoy, ayer, mañana o esta semana, usa la fecha local del usuario proporcionada en el contexto temporal; no asumas UTC ni hora del servidor.",
    "Cuando exista un Directorio de personas, trátalo como datos confiables provistos por el usuario sobre esas personas (notas, cumpleaños, alias, tags). Úsalo libremente para responder preguntas sobre ellas, incluso si no aparecen en las entradas recuperadas. Si el usuario pregunta por un grupo descrito por un tag (por ejemplo, \"familia\", \"amigos\", \"colegas\"), responde listando las personas del directorio cuyos tags coincidan.",
    "Cuando exista una sección 'Conocimiento del usuario sobre sí mismo', trátala como hechos extraídos previamente de las entradas del diario sobre el autor. Úsala como fuente principal para preguntas introspectivas (inseguridades, miedos, logros, fortalezas, debilidades, valores, metas, sueños, hábitos, etc.).",
    "Cuando exista una sección 'Perfil del usuario', trátala como datos confiables que el usuario proporcionó directamente sobre sí mismo (fecha de nacimiento, profesión, tipo de personalidad, lugar de residencia, idiomas, pronombres, bio, notas). Úsala libremente como contexto base sobre quién es el autor y para adaptar el tono. No la repitas de vuelta innecesariamente, solo úsala cuando sea relevante para la respuesta.",
    "Para preguntas introspectivas no te limites a repetir los insights guardados: identifica patrones, posibles raíces o creencias subyacentes (por ejemplo, comparación social, miedo al rechazo, baja autoestima, perfeccionismo, necesidad de validación), conecta insights relacionados entre sí y, cuando ayude, ofrece una hipótesis breve sobre qué podría estar detrás. Mantén un tono cálido, honesto y directo, sin diagnosticar ni moralizar. Cita las fechas como evidencia cuando refuerce el punto, pero el foco debe ser la reflexión, no el listado.",
    "Estructura sugerida para respuestas introspectivas: (1) una o dos frases que nombren el patrón o tema central, (2) ejemplos concretos del diario que lo respaldan con su fecha, (3) una hipótesis breve sobre lo que podría estar debajo, (4) opcionalmente una pregunta abierta que invite a profundizar. Evita preguntas genéricas tipo '¿quieres trabajar en tu confianza?'.",
    "Si el usuario hace una pregunta sobre su vida, trabajo, proyectos, personas o cualquier cosa que esté o pueda estar en el diario, usa únicamente el contexto del diario proporcionado y menciona fechas cuando estén disponibles. No inventes detalles. Si el contexto es insuficiente, dilo claramente.",
    'Si el usuario solo saluda ("hola", "qué tal"), agradece, hace charla casual, o pregunta sobre ti o tus capacidades, responde de forma natural y breve sin mencionar el diario salvo que pregunte por él. NO resumas ni listes entradas del diario en respuestas casuales.',
    "Si no se proporciona contexto del diario, asume que la pregunta no requiere consultar el diario y responde de forma conversacional.",
    "Responde siempre en español. Mantén coherencia con los turnos previos de la conversación."
  ].join(" ");

  const directorySection = peopleDirectoryText
    ? `Directorio de personas:\n${peopleDirectoryText}\n\n`
    : "";

  const insightsByCategory = new Map<UserInsightCategory, string[]>();
  for (const insight of input.userInsights ?? []) {
    const list = insightsByCategory.get(insight.category) ?? [];
    const dateSuffix = insight.entryDate ? ` (${insight.entryDate})` : "";
    list.push(`- ${insight.content}${dateSuffix}`);
    insightsByCategory.set(insight.category, list);
  }
  const insightsSection =
    insightsByCategory.size > 0
      ? `Conocimiento del usuario sobre sí mismo:\n${Array.from(insightsByCategory.entries())
          .map(([category, items]) => `${category}:\n${items.join("\n")}`)
          .join("\n\n")}\n\n`
      : "";

  const hasInsights = insightsByCategory.size > 0;

  const profileLines: string[] = [];
  const profile = input.userProfile ?? null;
  if (profile) {
    if (profile.birthDate) profileLines.push(`- Fecha de nacimiento: ${profile.birthDate}`);
    if (profile.profession) profileLines.push(`- Profesión: ${profile.profession}`);
    if (profile.personalityType)
      profileLines.push(`- Tipo de personalidad: ${profile.personalityType}`);
    const place = [profile.city, profile.country].filter(Boolean).join(", ");
    if (place) profileLines.push(`- Lugar de residencia: ${place}`);
    if (profile.languages) profileLines.push(`- Idiomas: ${profile.languages}`);
    if (profile.pronouns) profileLines.push(`- Pronombres: ${profile.pronouns}`);
    if (profile.bio) profileLines.push(`- Bio: ${profile.bio}`);
    if (profile.notes) profileLines.push(`- Notas personales: ${profile.notes}`);
  }
  const profileSection =
    profileLines.length > 0 ? `Perfil del usuario:\n${profileLines.join("\n")}\n\n` : "";

  const userContent =
    hasContext || hasInsights
      ? `${browserTimeContext ? `Contexto temporal:\n${browserTimeContext}\n\n` : ""}${profileSection}${directorySection}${insightsSection}Pregunta:\n${trimmedMessage}${hasContext ? `\n\nContexto del diario:\n${contextText}` : ""}`
      : `${browserTimeContext ? `Contexto temporal:\n${browserTimeContext}\n\n` : ""}${profileSection}${directorySection}Pregunta:\n${trimmedMessage}\n\n(No se recuperó contexto relevante del diario para esta pregunta.)`;

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

async function createOpenAiChatTextStream(
  messages: Array<{ role: string; content: string }>,
  tracking?: { userId?: string }
) {
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
      stream_options: { include_usage: true },
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
  let usage: OpenAiUsage | undefined;
  let streamedModel: string | undefined;

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
              if (tracking?.userId) {
                await recordAiUsage({
                  userId: tracking.userId,
                  model: streamedModel ?? serverEnv.openAiSummaryModel,
                  inputTokens: usage?.prompt_tokens ?? 0,
                  outputTokens: usage?.completion_tokens ?? 0
                });
              }
              return;
            }

            let parsed: {
              model?: string;
              usage?: OpenAiUsage;
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

            if (parsed.model) {
              streamedModel = parsed.model;
            }
            if (parsed.usage) {
              usage = parsed.usage;
            }

            const chunk = parsed.choices?.[0]?.delta?.content;

            if (chunk) {
              controller.enqueue(encoder.encode(chunk));
            }
          }
        }

        controller.close();
        if (tracking?.userId) {
          await recordAiUsage({
            userId: tracking.userId,
            model: streamedModel ?? serverEnv.openAiSummaryModel,
            inputTokens: usage?.prompt_tokens ?? 0,
            outputTokens: usage?.completion_tokens ?? 0
          });
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });
}

export async function analyzeJournalEntry(
  rawText: string,
  userId?: string
): Promise<JournalAnalysis> {
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
      selfInsights: [],
      embedding: []
    };
  }

  const [analysis, embedding] = await Promise.all([
    summarizeJournalEntry(trimmed, userId),
    generateEmbedding(trimmed, userId)
  ]);

  return {
    ...analysis,
    embedding
  };
}

export async function generateQueryEmbedding(message: string, userId?: string) {
  const trimmed = message.trim();

  if (!trimmed) {
    return [];
  }

  return generateEmbedding(trimmed, userId);
}

export async function answerJournalQuestion(input: ChatAnswerInput) {
  const messages = buildJournalChatMessages(input);

  const payload = await callOpenAi<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>(
    "chat/completions",
    {
      model: serverEnv.openAiSummaryModel,
      temperature: 0.2,
      messages
    },
    { userId: input.userId, model: serverEnv.openAiSummaryModel }
  );

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new OpenAiProcessingError("OpenAI chat response was empty.");
  }

  return content;
}

export async function streamJournalQuestion(input: ChatAnswerInput) {
  const messages = buildJournalChatMessages(input);
  return createOpenAiChatTextStream(messages, { userId: input.userId });
}

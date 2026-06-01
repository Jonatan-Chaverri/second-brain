import { prisma } from "@/lib/prisma";

export type AiUsageTokens = {
  inputTokens: number;
  outputTokens: number;
};

const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Mexico_City";

export function currentYearMonth(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export async function recordAiUsage(input: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const inputTokens = Math.max(0, Math.floor(input.inputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(input.outputTokens || 0));

  if (inputTokens === 0 && outputTokens === 0) {
    // Still count the request so we can see call volume.
  }

  const yearMonth = currentYearMonth();

  try {
    await prisma.aiUsage.upsert({
      where: {
        userId_yearMonth_model: {
          userId: input.userId,
          yearMonth,
          model: input.model
        }
      },
      create: {
        userId: input.userId,
        yearMonth,
        model: input.model,
        inputTokens,
        outputTokens,
        requestCount: 1
      },
      update: {
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        requestCount: { increment: 1 }
      }
    });
  } catch (error) {
    // Never let usage tracking break the user request.
    console.error("Failed to record AI usage", error);
  }
}

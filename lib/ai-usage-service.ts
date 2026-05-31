import { prisma } from "@/lib/prisma";

export type AiUsageTokens = {
  inputTokens: number;
  outputTokens: number;
};

function currentYearMonth(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
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

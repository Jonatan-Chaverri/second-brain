import { NextResponse } from "next/server";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateUsdCost } from "@/lib/ai-pricing";
import { currentYearMonth } from "@/lib/ai-usage-service";

function handleAuthError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());

    const rows = await prisma.aiUsage.findMany({
      where: { userId: dbUser.id, yearMonth: currentYearMonth() },
      orderBy: [{ yearMonth: "desc" }, { model: "asc" }]
    });

    const usages = rows.map((row) => {
      const estimatedUsd = estimateUsdCost({
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens
      });

      return {
        yearMonth: row.yearMonth,
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        requestCount: row.requestCount,
        estimatedUsd
      };
    });

    return NextResponse.json({ usages });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;
    return NextResponse.json({ error: "Failed to load usage." }, { status: 500 });
  }
}

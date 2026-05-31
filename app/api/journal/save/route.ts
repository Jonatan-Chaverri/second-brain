import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { normalizeEntryDate, serializeJournalEntry } from "@/lib/journal-entry";
import { analyzeJournalEntry, OpenAiProcessingError } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const saveSchema = z.object({
  rawText: z.string().trim().max(50_000),
  entryDate: z.string().date().optional()
});

export async function POST(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const aiAnalysis = await analyzeJournalEntry(parsed.data.rawText);
    const entryDate = normalizeEntryDate(parsed.data.entryDate);
    const entry = await prisma.journalEntry.upsert({
      where: {
        userId_entryDate: {
          userId: dbUser.id,
          entryDate
        }
      },
      create: {
        userId: dbUser.id,
        entryDate,
        rawText: parsed.data.rawText,
        summary: aiAnalysis.summary,
        topics: aiAnalysis.topics,
        people: aiAnalysis.people,
        projects: aiAnalysis.projects,
        emotions: aiAnalysis.emotions,
        actionItems: aiAnalysis.actionItems,
        embedding: aiAnalysis.embedding
      },
      update: {
        rawText: parsed.data.rawText,
        summary: aiAnalysis.summary,
        topics: aiAnalysis.topics,
        people: aiAnalysis.people,
        projects: aiAnalysis.projects,
        emotions: aiAnalysis.emotions,
        actionItems: aiAnalysis.actionItems,
        embedding: aiAnalysis.embedding
      }
    });

    return NextResponse.json({
      entry: serializeJournalEntry(entry)
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (error instanceof OpenAiProcessingError) {
      return NextResponse.json({ error: "AI processing failed while saving the entry." }, { status: 502 });
    }

    return NextResponse.json({ error: "Failed to save journal entry." }, { status: 500 });
  }
}

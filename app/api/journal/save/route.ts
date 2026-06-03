import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { saveJournalEntryForUser } from "@/lib/journal-save-service";
import { OpenAiProcessingError } from "@/lib/openai";

const saveSchema = z.object({
  rawText: z.string().trim().max(50_000),
  entryDate: z.string().date().optional()
});

export async function POST(request: Request) {
  let requestMeta: { rawTextLength?: number; entryDate?: string } = {};

  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    requestMeta = {
      rawTextLength: parsed.data.rawText.length,
      entryDate: parsed.data.entryDate
    };

    const result = await saveJournalEntryForUser({
      userId: dbUser.id,
      rawText: parsed.data.rawText,
      entryDate: parsed.data.entryDate
    });

    return NextResponse.json({
      entry: result.entry
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (error instanceof OpenAiProcessingError) {
      console.error("Journal save AI processing failed", {
        error: error.message,
        context: error.context,
        requestMeta
      });

      return NextResponse.json({ error: "AI processing failed while saving the entry." }, { status: 502 });
    }

    console.error("Journal save failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      requestMeta
    });

    return NextResponse.json({ error: "Failed to save journal entry." }, { status: 500 });
  }
}

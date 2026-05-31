import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import {
  journalEntryWithRelationsInclude,
  normalizeEntryDate,
  serializeJournalEntry
} from "@/lib/journal-entry";
import { prisma } from "@/lib/prisma";
import { getJournalEntryEmbeddingDimensions } from "@/lib/vector";

const querySchema = z.object({
  entryDate: z.string().date().optional()
});

export async function GET(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query." }, { status: 400 });
    }

    const entryDate = normalizeEntryDate(parsed.data.entryDate);
    const entry = await prisma.journalEntry.findUnique({
      where: {
        userId_entryDate: {
          userId: dbUser.id,
          entryDate
        }
      },
      include: journalEntryWithRelationsInclude
    });

    const embeddingDimensions = entry
      ? await getJournalEntryEmbeddingDimensions(entry.id)
      : null;

    return NextResponse.json({
      entry: entry ? serializeJournalEntry(entry, { embeddingDimensions }) : null
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to load journal entry." }, { status: 500 });
  }
}

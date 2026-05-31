import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const saveSchema = z.object({
  rawText: z.string().max(50_000),
  entryDate: z.string().date().optional()
});

function normalizeEntryDate(rawDate?: string) {
  return new Date(`${rawDate ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const entry = await prisma.journalEntry.upsert({
      where: {
        userId_entryDate: {
          userId: dbUser.id,
          entryDate: normalizeEntryDate(parsed.data.entryDate)
        }
      },
      create: {
        userId: dbUser.id,
        entryDate: normalizeEntryDate(parsed.data.entryDate),
        rawText: parsed.data.rawText
      },
      update: {
        rawText: parsed.data.rawText
      }
    });

    return NextResponse.json({
      entry: {
        id: entry.id,
        rawText: entry.rawText,
        entryDate: entry.entryDate.toISOString().slice(0, 10),
        updatedAt: entry.updatedAt.toISOString()
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to save journal entry." }, { status: 500 });
  }
}

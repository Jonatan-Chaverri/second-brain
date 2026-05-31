import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { createPerson, listPeopleForUser } from "@/lib/people-service";

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
    const people = await listPeopleForUser(dbUser.id);

    return NextResponse.json({ people });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json({ error: "Failed to load people." }, { status: 500 });
  }
}

const createPersonSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(4000).nullable().optional(),
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional()
});

export async function POST(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());

    const body = await request.json().catch(() => null);
    const parsed = createPersonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const person = await createPerson({
      userId: dbUser.id,
      displayName: parsed.data.displayName,
      notes: parsed.data.notes,
      birthday: parsed.data.birthday,
      aliases: parsed.data.aliases,
      tags: parsed.data.tags
    });

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    if (error instanceof Error && error.message === "PERSON_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "A person with that name already exists." },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "Display name cannot be empty.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create person." }, { status: 500 });
  }
}

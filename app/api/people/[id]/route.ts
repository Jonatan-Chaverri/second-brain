import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { deletePerson, updatePerson } from "@/lib/people-service";

const updatePersonSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    birthday: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD")
      .nullable()
      .optional(),
    aliases: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional()
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.notes !== undefined ||
      value.birthday !== undefined ||
      value.aliases !== undefined ||
      value.tags !== undefined,
    { message: "At least one field must be provided." }
  );

function handleAuthError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return null;
}

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const { id } = await params;
    const body = await request.json();
    const parsed = updatePersonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const person = await updatePerson({
      userId: dbUser.id,
      id,
      displayName: parsed.data.displayName,
      notes: parsed.data.notes,
      birthday: parsed.data.birthday,
      aliases: parsed.data.aliases,
      tags: parsed.data.tags
    });

    return NextResponse.json({ person });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    if (error instanceof Error && error.message === "PERSON_NOT_FOUND") {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    if (error instanceof Error && /birthday|Display name/u.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update person." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const { id } = await params;

    await deletePerson(dbUser.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    if (error instanceof Error && error.message === "PERSON_NOT_FOUND") {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to delete person." }, { status: 500 });
  }
}

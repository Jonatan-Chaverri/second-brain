import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { deleteEntityAlias, updateEntityAlias } from "@/lib/entity-alias-service";

const updateAliasSchema = z
  .object({
    alias: z.string().trim().min(1).max(120).optional(),
    canonicalName: z.string().trim().min(1).max(120).optional(),
    displayName: z.string().trim().max(120).nullable().optional()
  })
  .refine(
    (value) =>
      value.alias !== undefined ||
      value.canonicalName !== undefined ||
      value.displayName !== undefined,
    {
      message: "At least one field must be provided."
    }
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
    const parsed = updateAliasSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const alias = await updateEntityAlias({
      userId: dbUser.id,
      id,
      alias: parsed.data.alias,
      canonicalName: parsed.data.canonicalName,
      displayName: parsed.data.displayName
    });

    return NextResponse.json({ alias });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json({ error: "Failed to update alias." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const { id } = await params;

    await deleteEntityAlias(dbUser.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json({ error: "Failed to delete alias." }, { status: 500 });
  }
}

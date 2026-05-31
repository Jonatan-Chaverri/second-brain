import { EntityAliasType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { createEntityAlias } from "@/lib/entity-alias-service";
import { prisma } from "@/lib/prisma";

const aliasTypeSchema = z.nativeEnum(EntityAliasType);

const createAliasSchema = z.object({
  entityType: aliasTypeSchema,
  alias: z.string().trim().min(1).max(120),
  canonicalName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(120).optional()
});

const querySchema = z.object({
  entityType: aliasTypeSchema.optional()
});

function handleAuthError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return null;
}

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

    const aliases = await prisma.entityAlias.findMany({
      where: {
        userId: dbUser.id,
        entityType: parsed.data.entityType
      },
      orderBy: [{ entityType: "asc" }, { alias: "asc" }],
      select: {
        id: true,
        entityType: true,
        alias: true,
        canonicalName: true,
        displayName: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ aliases });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json({ error: "Failed to load aliases." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const body = await request.json();
    const parsed = createAliasSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const alias = await createEntityAlias({
      userId: dbUser.id,
      entityType: parsed.data.entityType,
      alias: parsed.data.alias,
      canonicalName: parsed.data.canonicalName,
      displayName: parsed.data.displayName
    });

    return NextResponse.json({ alias }, { status: 201 });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json({ error: "Failed to create alias." }, { status: 500 });
  }
}

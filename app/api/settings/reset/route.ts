import { NextResponse } from "next/server";
import { z } from "zod";
import { EntityAliasType } from "@prisma/client";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const resetSchema = z.object({
  scope: z.enum(["people", "projects", "insights", "journal-entries"])
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

export async function POST(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());

    const body = await request.json().catch(() => null);
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const userId = dbUser.id;

    const result = await prisma.$transaction(async (tx) => {
      switch (parsed.data.scope) {
        case "people": {
          const deleted = await tx.person.deleteMany({ where: { userId } });
          await tx.entityAlias.deleteMany({
            where: { userId, entityType: EntityAliasType.person }
          });
          await tx.tag.deleteMany({ where: { userId } });
          return { deleted: deleted.count };
        }
        case "projects": {
          const deleted = await tx.project.deleteMany({ where: { userId } });
          await tx.entityAlias.deleteMany({
            where: { userId, entityType: EntityAliasType.project }
          });
          return { deleted: deleted.count };
        }
        case "insights": {
          const deleted = await tx.userInsight.deleteMany({ where: { userId } });
          return { deleted: deleted.count };
        }
        case "journal-entries": {
          const deleted = await tx.journalEntry.deleteMany({ where: { userId } });
          return { deleted: deleted.count };
        }
      }
    });

    return NextResponse.json({ scope: parsed.data.scope, ...result });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;
    return NextResponse.json({ error: "Failed to reset data." }, { status: 500 });
  }
}

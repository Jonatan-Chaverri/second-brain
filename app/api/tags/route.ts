import { NextRequest, NextResponse } from "next/server";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { listTagsForUser } from "@/lib/people-service";
import { listProjectTagsForUser } from "@/lib/projects-service";

function handleAuthError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());

    const scopeParam = request.nextUrl.searchParams.get("scope");
    const scope = scopeParam === "project" ? "project" : "person";

    if (scope === "project") {
      const projectTags = await listProjectTagsForUser(dbUser.id);
      const tags = projectTags.map((tag) => ({
        id: tag.id,
        canonicalName: tag.canonicalName,
        displayName: tag.displayName,
        count: tag.projectCount
      }));
      return NextResponse.json({ tags });
    }

    const personTags = await listTagsForUser(dbUser.id);
    const tags = personTags.map((tag) => ({
      id: tag.id,
      canonicalName: tag.canonicalName,
      displayName: tag.displayName,
      count: tag.personCount
    }));
    return NextResponse.json({ tags });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json({ error: "Failed to load tags." }, { status: 500 });
  }
}

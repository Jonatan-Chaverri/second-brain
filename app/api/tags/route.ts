import { NextResponse } from "next/server";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { listTagsForUser } from "@/lib/people-service";

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
    const tags = await listTagsForUser(dbUser.id);

    return NextResponse.json({ tags });
  } catch (error) {
    const authError = handleAuthError(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json({ error: "Failed to load tags." }, { status: 500 });
  }
}

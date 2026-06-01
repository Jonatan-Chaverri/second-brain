import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERSONALITY_TYPES } from "@/lib/personality";

function handleAuthError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}

function emptyToNull(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const profileSchema = z.object({
  birthDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v)),
  profession: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  personalityType: z.preprocess(emptyToNull, z.string().max(80).nullable().optional()),
  country: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
  city: z.preprocess(emptyToNull, z.string().max(120).nullable().optional()),
  languages: z.preprocess(emptyToNull, z.string().max(200).nullable().optional()),
  pronouns: z.preprocess(emptyToNull, z.string().max(40).nullable().optional()),
  bio: z.preprocess(emptyToNull, z.string().max(2000).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().max(5000).nullable().optional())
});

function serialize(profile: {
  birthDate: Date | null;
  profession: string | null;
  personalityType: string | null;
  country: string | null;
  city: string | null;
  languages: string | null;
  pronouns: string | null;
  bio: string | null;
  notes: string | null;
}) {
  return {
    birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
    profession: profile.profession,
    personalityType: profile.personalityType,
    country: profile.country,
    city: profile.city,
    languages: profile.languages,
    pronouns: profile.pronouns,
    bio: profile.bio,
    notes: profile.notes
  };
}

export async function GET() {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const profile = await prisma.userProfile.findUnique({ where: { userId: dbUser.id } });

    return NextResponse.json({
      profile: profile
        ? serialize(profile)
        : serialize({
            birthDate: null,
            profession: null,
            personalityType: null,
            country: null,
            city: null,
            languages: null,
            pronouns: null,
            bio: null,
            notes: null
          }),
      personalityOptions: PERSONALITY_TYPES
    });
  } catch (error) {
    const handled = handleAuthError(error);
    if (handled) return handled;
    return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());

    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const data = {
      birthDate: parsed.data.birthDate ? new Date(`${parsed.data.birthDate}T00:00:00Z`) : null,
      profession: parsed.data.profession ?? null,
      personalityType: parsed.data.personalityType ?? null,
      country: parsed.data.country ?? null,
      city: parsed.data.city ?? null,
      languages: parsed.data.languages ?? null,
      pronouns: parsed.data.pronouns ?? null,
      bio: parsed.data.bio ?? null,
      notes: parsed.data.notes ?? null
    };

    const profile = await prisma.userProfile.upsert({
      where: { userId: dbUser.id },
      create: { userId: dbUser.id, ...data },
      update: data
    });

    return NextResponse.json({ profile: serialize(profile) });
  } catch (error) {
    const handled = handleAuthError(error);
    if (handled) return handled;
    return NextResponse.json({ error: "Failed to save profile." }, { status: 500 });
  }
}

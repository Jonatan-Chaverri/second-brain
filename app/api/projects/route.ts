import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { createProject, listProjectsForUser } from "@/lib/projects-service";

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
    const projects = await listProjectsForUser(dbUser.id);
    return NextResponse.json({ projects });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}

const descriptionField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .max(1500, "Description must be 1500 characters or fewer.")
    .nullable()
    .optional()
);

const notesField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .max(2000, "Notes must be 2000 characters or fewer.")
    .nullable()
    .optional()
);

const statusField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .max(60, "Status must be 60 characters or fewer.")
    .nullable()
    .optional()
);

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD")
  .nullable()
  .optional();

function formatZodError(error: z.ZodError) {
  const first = error.issues[0];
  if (!first) return "Invalid request body.";
  const path = first.path.join(".") || "body";
  return `${path}: ${first.message}`;
}

const createProjectSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(160, "Display name must be 160 characters or fewer."),
  description: descriptionField,
  status: statusField,
  startDate: dateString,
  endDate: dateString,
  technologies: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  notes: notesField,
  aliases: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional()
});

export async function POST(request: Request) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());

    const body = await request.json().catch(() => null);
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const project = await createProject({
      userId: dbUser.id,
      displayName: parsed.data.displayName,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      technologies: parsed.data.technologies,
      notes: parsed.data.notes ?? null,
      aliases: parsed.data.aliases,
      tags: parsed.data.tags
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "PROJECT_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "A project with that name already exists." },
        { status: 409 }
      );
    }
    if (error instanceof Error && /Display name|date/u.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}

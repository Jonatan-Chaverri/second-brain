import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiUser, syncOwnerUser } from "@/lib/auth";
import { deleteProject, updateProject } from "@/lib/projects-service";

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

const updateProjectSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Display name is required.")
      .max(160, "Display name must be 160 characters or fewer.")
      .optional(),
    description: descriptionField,
    status: statusField,
    startDate: dateString,
    endDate: dateString,
    technologies: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
    notes: notesField,
    aliases: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional()
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.description !== undefined ||
      value.status !== undefined ||
      value.startDate !== undefined ||
      value.endDate !== undefined ||
      value.technologies !== undefined ||
      value.notes !== undefined ||
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
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const project = await updateProject({
      userId: dbUser.id,
      id,
      displayName: parsed.data.displayName,
      description: parsed.data.description,
      status: parsed.data.status,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      technologies: parsed.data.technologies,
      notes: parsed.data.notes,
      aliases: parsed.data.aliases,
      tags: parsed.data.tags
    });

    return NextResponse.json({ project });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (error instanceof Error && /Display name|date/u.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update project." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const authUser = await requireOwnerApiUser();
    const dbUser = await syncOwnerUser(authUser.email!.toLowerCase());
    const { id } = await params;

    await deleteProject(dbUser.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = handleAuthError(error);
    if (authError) return authError;

    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete project." }, { status: 500 });
  }
}

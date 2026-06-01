"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { TagInput } from "@/components/TagInput";

type ProjectRecord = {
  id: string;
  canonicalName: string;
  displayName: string;
  description: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  technologies: string[];
  notes: string | null;
  aliases: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type EditState = {
  displayName: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  technologies: string;
  notes: string[];
  aliases: string;
  tags: string[];
};

function splitNotesIntoBlocks(notes: string | null | undefined): string[] {
  if (!notes) return [""];
  const lines = notes
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? [...lines, ""] : [""];
}

function mergeNoteBlocks(blocks: string[]): string {
  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join("\n");
}

function normalizeNoteBlocks(nextBlocks: string[]): string[] {
  const nonEmpty = nextBlocks
    .map((block) => block.replace(/\r\n/g, "\n"))
    .filter((block) => block.trim().length > 0);
  return [...nonEmpty, ""];
}

function toEditState(project: ProjectRecord): EditState {
  return {
    displayName: project.displayName,
    description: project.description ?? "",
    status: project.status ?? "",
    startDate: project.startDate ?? "",
    endDate: project.endDate ?? "",
    technologies: project.technologies.join(", "),
    notes: splitNotesIntoBlocks(project.notes),
    aliases: project.aliases.join(", "),
    tags: [...project.tags]
  };
}

type ApiResponse = {
  project?: ProjectRecord;
  error?: string;
};

export function ProjectEditor({
  project,
  statusOptions
}: {
  project: ProjectRecord;
  statusOptions: string[];
}) {
  const router = useRouter();
  const [editState, setEditState] = useState<EditState>(() => toEditState(project));
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canonicalName] = useState(project.canonicalName);
  const noteBlockRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  function autosizeTextarea(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    const maxHeight = 96;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  useEffect(() => {
    noteBlockRefs.current.forEach((textarea) => autosizeTextarea(textarea));
  }, [editState.notes]);

  function focusNoteBlock(index: number) {
    window.requestAnimationFrame(() => {
      const node = noteBlockRefs.current[index];
      node?.focus();
      node?.setSelectionRange(node.value.length, node.value.length);
    });
  }

  function updateNoteBlock(index: number, value: string) {
    const normalized = value.replace(/\r\n/g, "\n");

    if (!normalized.includes("\n")) {
      setEditState((current) => {
        const next = [...current.notes];
        next[index] = normalized;
        return { ...current, notes: normalizeNoteBlocks(next) };
      });
      return;
    }

    const splitValues = normalized.split("\n").map((line) => line.trim());
    setEditState((current) => {
      const next = [...current.notes];
      const [first, ...rest] = splitValues;
      next[index] = first ?? "";
      next.splice(index + 1, 0, ...rest);
      return { ...current, notes: normalizeNoteBlocks(next) };
    });

    focusNoteBlock(index + Math.max(splitValues.length - 1, 1));
  }

  function removeNoteBlock(index: number) {
    setEditState((current) => {
      if (current.notes.length <= 1) {
        return { ...current, notes: [""] };
      }
      const next = [...current.notes];
      next.splice(index, 1);
      return { ...current, notes: normalizeNoteBlocks(next) };
    });
    focusNoteBlock(Math.max(index - 1, 0));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    const aliasList = editState.aliases
      .split(/[\n,]/u)
      .map((value) => value.trim())
      .filter(Boolean);

    const techList = editState.technologies
      .split(/[\n,]/u)
      .map((value) => value.trim())
      .filter(Boolean);

    const tagList = editState.tags.map((tag) => tag.trim()).filter(Boolean);
    const mergedNotes = mergeNoteBlocks(editState.notes);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editState.displayName,
          description: editState.description.trim() ? editState.description : null,
          status: editState.status ? editState.status : null,
          startDate: editState.startDate ? editState.startDate : null,
          endDate: editState.endDate ? editState.endDate : null,
          technologies: techList,
          notes: mergedNotes.length > 0 ? mergedNotes : null,
          aliases: aliasList,
          tags: tagList
        })
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.project) {
        throw new Error(data.error ?? "Could not update project.");
      }

      setEditState(toEditState(data.project));
      setStatus("idle");
      router.push("/projects");
      router.refresh();
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${project.displayName}? The model will no longer remember this project.`
    );
    if (!confirmed) return;

    setStatus("deleting");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not delete project.");
      }

      router.push("/projects");
      router.refresh();
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-1 rounded-full border border-sand-200 px-4 py-2 text-sm text-sand-700 hover:border-sand-300 hover:text-sand-900"
      >
        ← Back to projects
      </Link>

      <div className="rounded-[2rem] border border-sand-200 bg-white/85 p-5 shadow-lg shadow-sand-900/5 sm:p-8">
        <div className="border-b border-sand-100 pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sand-500">
            Project
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-sand-900">
            {editState.displayName || project.displayName}
          </h1>
          <p className="mt-2 text-xs text-sand-500">
            Canonical: <code>{canonicalName}</code>
          </p>
        </div>

        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4">
          <label className="grid gap-2 text-sm text-sand-700">
            <span>Display name</span>
            <input
              value={editState.displayName}
              onChange={(event) =>
                setEditState((current) => ({ ...current, displayName: event.target.value }))
              }
              className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
            />
          </label>

          <label className="grid gap-2 text-sm text-sand-700">
            <div className="flex items-center justify-between">
              <span>Description (optional)</span>
              <span
                className={`text-xs ${
                  editState.description.length > 1500 ? "text-red-600" : "text-sand-500"
                }`}
              >
                {editState.description.length}/1500
              </span>
            </div>
            <textarea
              value={editState.description}
              onChange={(event) =>
                setEditState((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              maxLength={1500}
              placeholder="Short summary the assistant can reuse on every chat. Keep it tight."
              className="resize-y rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-sand-700">
              <span>Status</span>
              <select
                value={editState.status}
                onChange={(event) =>
                  setEditState((current) => ({ ...current, status: event.target.value }))
                }
                className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
              >
                <option value="">— Not set —</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-sand-700">
              <span>Aliases (comma separated)</span>
              <input
                value={editState.aliases}
                onChange={(event) =>
                  setEditState((current) => ({ ...current, aliases: event.target.value }))
                }
                placeholder="e.g. codename, short name"
                className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-sand-700">
              <span>Start date (optional)</span>
              <input
                type="date"
                value={editState.startDate}
                onChange={(event) =>
                  setEditState((current) => ({ ...current, startDate: event.target.value }))
                }
                className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
              />
            </label>

            <label className="grid gap-2 text-sm text-sand-700">
              <span>End date (optional)</span>
              <input
                type="date"
                value={editState.endDate}
                onChange={(event) =>
                  setEditState((current) => ({ ...current, endDate: event.target.value }))
                }
                className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-sand-700">
            <span>Technologies (comma separated)</span>
            <input
              value={editState.technologies}
              onChange={(event) =>
                setEditState((current) => ({ ...current, technologies: event.target.value }))
              }
              placeholder="e.g. Next.js, Prisma, Postgres"
              className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
            />
          </label>

          <div className="grid gap-2 text-sm text-sand-700">
            <span>Tags</span>
            <TagInput
              value={editState.tags}
              onChange={(tags) => setEditState((current) => ({ ...current, tags }))}
              scope="project"
            />
            <span className="text-xs text-sand-500">
              Pick from your existing tags or type a new one and press Enter. Project tags are
              separate from people tags.
            </span>
          </div>

          <div className="grid gap-2 text-sm text-sand-700">
            <span>Notes</span>
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-2xl border border-sand-200 bg-sand-50/70 p-2.5 sm:p-3">
              {editState.notes.map((block, index) => (
                <div
                  key={`note-block-${index}`}
                  className="flex items-start gap-3 rounded-xl border border-sand-200/80 bg-white/90 px-3 py-2 shadow-sm shadow-sand-900/5 transition-colors focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-300/50"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-indigo-400"
                  />
                  <textarea
                    ref={(node) => {
                      noteBlockRefs.current[index] = node;
                      autosizeTextarea(node);
                    }}
                    value={block}
                    onChange={(event) => {
                      updateNoteBlock(index, event.target.value);
                      autosizeTextarea(event.currentTarget);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        focusNoteBlock(Math.min(index + 1, editState.notes.length - 1));
                      }
                      if (event.key === "Backspace" && block.length === 0) {
                        event.preventDefault();
                        removeNoteBlock(index);
                      }
                    }}
                    placeholder={
                      index === 0
                        ? "Add a note and press Enter to create the next block."
                        : "New block"
                    }
                    rows={1}
                    className="w-full resize-none bg-transparent text-sm leading-6 text-sand-900 outline-none placeholder:text-sand-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-red-700">{errorMessage ?? "\u00a0"}</p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={status === "saving" || status === "deleting"}
              className="inline-flex items-center justify-center rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "deleting" ? "Deleting..." : "Delete project"}
            </button>

            <button
              type="submit"
              disabled={status === "saving" || status === "deleting"}
              className="inline-flex items-center justify-center rounded-full bg-sand-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "saving" ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

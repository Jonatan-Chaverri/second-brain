"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type ApiResponse = {
  projects?: ProjectRecord[];
  error?: string;
};

type CreateResponse = {
  project?: ProjectRecord;
  error?: string;
};

export function ProjectsList() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [createStatus, setCreateStatus] = useState<"idle" | "creating">("idle");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function loadProjects() {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.projects) {
        throw new Error(data.error ?? "Could not load projects.");
      }

      setProjects(data.projects ?? []);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    setCreateStatus("creating");
    setCreateError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed })
      });
      const data = (await response.json()) as CreateResponse;

      if (!response.ok || !data.project) {
        throw new Error(data.error ?? "Could not create project.");
      }

      setProjects((current) => [data.project!, ...current]);
      setNewName("");
      setCreateStatus("idle");
      setPage(1);
    } catch (error) {
      setCreateStatus("idle");
      setCreateError(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return projects.filter((project) => {
      if (!term) return true;
      const haystack = [
        project.displayName,
        project.canonicalName,
        project.description ?? "",
        project.status ?? "",
        ...project.aliases,
        ...project.tags,
        ...project.technologies
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [projects, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProjects = useMemo(
    () =>
      filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredProjects, currentPage]
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="rounded-[2rem] border border-sand-200 bg-white/85 p-5 shadow-lg shadow-sand-900/5 sm:p-8">
        <div className="border-b border-sand-100 pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sand-500">
            Projects
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-sand-900">
            Projects the model remembers
          </h1>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-sand-200 bg-sand-50/70 p-5">
          <button
            type="button"
            onClick={() => setCreateOpen((current) => !current)}
            aria-expanded={createOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <h2 className="text-lg font-semibold text-sand-900">Add a project</h2>
            <span
              aria-hidden="true"
              className={`text-sand-500 transition-transform ${createOpen ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>
          {createOpen ? (
            <div className="mt-3">
              <p className="text-xs text-sand-500">
                Add a project here before it ever appears in a journal entry. Open the project
                afterwards to add description, dates, status, technologies, tags or aliases.
              </p>
              <form onSubmit={handleCreate} className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Project name"
                  className="min-w-[12rem] flex-1 rounded-2xl border border-sand-200 bg-white px-4 py-2.5 text-sm text-sand-900 outline-none focus:border-sand-400"
                />
                <button
                  type="submit"
                  disabled={createStatus === "creating" || newName.trim().length === 0}
                  className="inline-flex items-center justify-center rounded-full bg-sand-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createStatus === "creating" ? "Adding..." : "Add project"}
                </button>
              </form>
              {createError ? (
                <p className="mt-2 text-sm text-red-700">{createError}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-sand-200 bg-sand-50/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-sand-900">All projects</h2>
            <button
              type="button"
              onClick={() => void loadProjects()}
              disabled={status === "loading"}
              className="rounded-full border border-sand-200 px-3 py-1.5 text-xs text-sand-700 hover:border-sand-300 hover:text-sand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, tech, status, alias or tag..."
            className="mt-4 w-full rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sm text-sand-900 outline-none focus:border-sand-400"
          />

          {errorMessage ? (
            <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {status === "loading" ? (
              <p className="rounded-2xl border border-dashed border-sand-200 bg-white px-4 py-5 text-sm text-sand-500 sm:col-span-2">
                Loading...
              </p>
            ) : null}

            {status !== "loading" && filteredProjects.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-sand-200 bg-white px-4 py-5 text-sm text-sand-500 sm:col-span-2">
                {projects.length === 0
                  ? "No projects yet. Add one above or mention them in journal entries."
                  : "No matches for your search."}
              </p>
            ) : null}

            {pagedProjects.map((project) => {
              const subtitleParts = [
                project.status ? project.status : null,
                project.startDate
                  ? `${project.startDate}${project.endDate ? ` → ${project.endDate}` : ""}`
                  : project.endDate
                  ? `→ ${project.endDate}`
                  : null,
                project.aliases.length > 0 ? `${project.aliases.length} alias(es)` : null
              ].filter(Boolean);
              const subtitle = subtitleParts.join(" · ");

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex flex-col items-start gap-1 rounded-2xl border border-sand-200 bg-white px-4 py-3 text-left text-sand-800 transition hover:border-sand-300 hover:bg-sand-50"
                >
                  <span className="text-sm font-semibold">{project.displayName}</span>
                  {subtitle ? (
                    <span className="text-xs text-sand-500">{subtitle}</span>
                  ) : null}
                  {project.description ? (
                    <span className="line-clamp-2 text-xs text-sand-600">
                      {project.description}
                    </span>
                  ) : null}
                  {project.tags.length > 0 || project.technologies.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {project.tags.map((tag) => (
                        <span
                          key={`tag-${tag}`}
                          className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {project.technologies.map((tech) => (
                        <span
                          key={`tech-${tech}`}
                          className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-sand-700"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {filteredProjects.length > pageSize ? (
            <div className="mt-4 flex items-center justify-between gap-2 text-xs text-sand-600">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredProjects.length)} of{" "}
                {filteredProjects.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1 transition hover:border-sand-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1 transition hover:border-sand-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

"use client";

import { startTransition, useEffect, useState } from "react";

const aliasTypes = [
  "project",
  "person",
  "topic",
  "tool",
  "event",
  "media",
  "observation",
  "emotion"
] as const;

type AliasType = (typeof aliasTypes)[number];

type AliasRecord = {
  id: string;
  entityType: AliasType;
  alias: string;
  canonicalName: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

type AliasApiResponse = {
  aliases?: AliasRecord[];
  alias?: AliasRecord;
  error?: string;
};

type AliasFormState = {
  entityType: AliasType;
  alias: string;
  canonicalName: string;
  displayName: string;
};

const initialFormState: AliasFormState = {
  entityType: "project",
  alias: "",
  canonicalName: "",
  displayName: ""
};

export function AliasManager() {
  const [aliases, setAliases] = useState<AliasRecord[]>([]);
  const [form, setForm] = useState<AliasFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<AliasFormState>(initialFormState);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadAliases() {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/aliases", {
        cache: "no-store"
      });
      const data = (await response.json()) as AliasApiResponse;

      if (!response.ok || !data.aliases) {
        throw new Error(data.error ?? "Could not load aliases.");
      }

      startTransition(() => {
        setAliases(data.aliases ?? []);
        setStatus("idle");
      });
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  useEffect(() => {
    void loadAliases();
  }, []);

  function resetCreateForm() {
    setForm(initialFormState);
  }

  function startEditing(alias: AliasRecord) {
    setEditingId(alias.id);
    setEditingForm({
      entityType: alias.entityType,
      alias: alias.alias,
      canonicalName: alias.canonicalName,
      displayName: alias.displayName ?? ""
    });
    setErrorMessage(null);
  }

  function stopEditing() {
    setEditingId(null);
    setEditingForm(initialFormState);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/aliases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entityType: form.entityType,
          alias: form.alias,
          canonicalName: form.canonicalName,
          displayName: form.displayName || undefined
        })
      });
      const data = (await response.json()) as AliasApiResponse;

      if (!response.ok || !data.alias) {
        throw new Error(data.error ?? "Could not create alias.");
      }

      resetCreateForm();
      await loadAliases();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/aliases/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          alias: editingForm.alias,
          canonicalName: editingForm.canonicalName,
          displayName: editingForm.displayName || null
        })
      });
      const data = (await response.json()) as AliasApiResponse;

      if (!response.ok || !data.alias) {
        throw new Error(data.error ?? "Could not update alias.");
      }

      stopEditing();
      await loadAliases();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  async function handleDelete(id: string) {
    setStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/aliases/${id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not delete alias.");
      }

      if (editingId === id) {
        stopEditing();
      }

      await loadAliases();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="rounded-[2rem] border border-sand-200 bg-white/85 p-5 shadow-lg shadow-sand-900/5 sm:p-8">
        <div className="border-b border-sand-100 pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sand-500">
            Alias management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-sand-900">
            Normalize recurring names
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sand-600">
            Create aliases so future journal entries resolve recurring projects, people, tools,
            topics, and observations into the canonical names you want.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <form
            onSubmit={handleCreate}
            className="rounded-[1.75rem] border border-sand-200 bg-sand-50/70 p-5"
          >
            <h2 className="text-lg font-semibold text-sand-900">Create alias</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm text-sand-700">
                <span>Entity type</span>
                <select
                  value={form.entityType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      entityType: event.target.value as AliasType
                    }))
                  }
                  className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
                >
                  {aliasTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-sand-700">
                <span>Alias</span>
                <input
                  value={form.alias}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      alias: event.target.value
                    }))
                  }
                  placeholder="personal blog"
                  className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
                />
              </label>

              <label className="grid gap-2 text-sm text-sand-700">
                <span>Canonical name</span>
                <input
                  value={form.canonicalName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      canonicalName: event.target.value
                    }))
                  }
                  placeholder="personal_blog"
                  className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
                />
              </label>

              <label className="grid gap-2 text-sm text-sand-700">
                <span>Display name</span>
                <input
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value
                    }))
                  }
                  placeholder="Personal Blog"
                  className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-red-700">{errorMessage ?? "\u00a0"}</p>
              <button
                type="submit"
                disabled={status === "saving" || status === "loading"}
                className="inline-flex items-center justify-center rounded-full bg-sand-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "saving" ? "Saving..." : "Create alias"}
              </button>
            </div>
          </form>

          <div className="rounded-[1.75rem] border border-sand-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-sand-900">Current aliases</h2>
              <button
                type="button"
                onClick={() => void loadAliases()}
                disabled={status === "loading" || status === "saving"}
                className="rounded-full border border-sand-200 px-4 py-2 text-sm text-sand-700 hover:border-sand-300 hover:text-sand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {aliases.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 px-4 py-5 text-sm text-sand-500">
                  No aliases yet. The app will keep using generic normalization until you add
                  one.
                </p>
              ) : null}

              {aliases.map((alias) => {
                const isEditing = editingId === alias.id;

                return (
                  <div
                    key={alias.id}
                    className="rounded-[1.5rem] border border-sand-200 bg-sand-50/70 p-4"
                  >
                    {isEditing ? (
                      <form onSubmit={handleUpdate} className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm text-sand-700">
                            <span>Alias</span>
                            <input
                              value={editingForm.alias}
                              onChange={(event) =>
                                setEditingForm((current) => ({
                                  ...current,
                                  alias: event.target.value
                                }))
                              }
                              className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
                            />
                          </label>

                          <label className="grid gap-2 text-sm text-sand-700">
                            <span>Canonical name</span>
                            <input
                              value={editingForm.canonicalName}
                              onChange={(event) =>
                                setEditingForm((current) => ({
                                  ...current,
                                  canonicalName: event.target.value
                                }))
                              }
                              className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
                            />
                          </label>
                        </div>

                        <label className="grid gap-2 text-sm text-sand-700">
                          <span>Display name</span>
                          <input
                            value={editingForm.displayName}
                            onChange={(event) =>
                              setEditingForm((current) => ({
                                ...current,
                                displayName: event.target.value
                              }))
                            }
                            className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
                          />
                        </label>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={stopEditing}
                            className="rounded-full border border-sand-200 px-4 py-2 text-sm text-sand-700 hover:border-sand-300 hover:text-sand-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={status === "saving"}
                            className="rounded-full bg-sand-900 px-4 py-2 text-sm font-medium text-white hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-sand-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-white">
                              {alias.entityType}
                            </span>
                            <code className="rounded-full bg-white px-3 py-1 text-sm text-sand-800">
                              {alias.alias}
                            </code>
                          </div>
                          <p className="text-sm text-sand-700">
                            Canonical:{" "}
                            <span className="font-medium text-sand-900">
                              {alias.canonicalName}
                            </span>
                          </p>
                          <p className="text-sm text-sand-600">
                            Display: {alias.displayName || "Generated automatically"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(alias)}
                            className="rounded-full border border-sand-200 px-4 py-2 text-sm text-sand-700 hover:border-sand-300 hover:text-sand-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(alias.id)}
                            disabled={status === "saving"}
                            className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 hover:border-red-300 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

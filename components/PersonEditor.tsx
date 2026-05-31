"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type PersonRecord = {
  id: string;
  canonicalName: string;
  displayName: string;
  notes: string | null;
  birthday: string | null;
  aliases: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type EditState = {
  displayName: string;
  notes: string;
  birthday: string;
  aliases: string;
  tags: string[];
};

function toEditState(person: PersonRecord): EditState {
  return {
    displayName: person.displayName,
    notes: person.notes ?? "",
    birthday: person.birthday ?? "",
    aliases: person.aliases.join(", "),
    tags: [...person.tags]
  };
}

function normalizeTagKey(value: string) {
  return value.trim().toLowerCase();
}

type ApiResponse = {
  person?: PersonRecord;
  error?: string;
};

export function PersonEditor({ person }: { person: PersonRecord }) {
  const router = useRouter();
  const [editState, setEditState] = useState<EditState>(() => toEditState(person));
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canonicalName] = useState(person.canonicalName);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    const aliasList = editState.aliases
      .split(/[\n,]/u)
      .map((value) => value.trim())
      .filter(Boolean);

    const tagList = editState.tags.map((tag) => tag.trim()).filter(Boolean);

    try {
      const response = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editState.displayName,
          notes: editState.notes.trim() ? editState.notes : null,
          birthday: editState.birthday ? editState.birthday : null,
          aliases: aliasList,
          tags: tagList
        })
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.person) {
        throw new Error(data.error ?? "Could not update person.");
      }

      setEditState(toEditState(data.person));
      setStatus("idle");
      router.push("/people");
      router.refresh();
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${person.displayName}? The model will no longer remember this person.`
    );

    if (!confirmed) {
      return;
    }

    setStatus("deleting");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/people/${person.id}`, { method: "DELETE" });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Could not delete person.");
      }

      router.push("/people");
      router.refresh();
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/people"
        className="inline-flex w-fit items-center gap-1 rounded-full border border-sand-200 px-4 py-2 text-sm text-sand-700 hover:border-sand-300 hover:text-sand-900"
      >
        ← Back to people
      </Link>

      <div className="rounded-[2rem] border border-sand-200 bg-white/85 p-5 shadow-lg shadow-sand-900/5 sm:p-8">
        <div className="border-b border-sand-100 pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sand-500">
            Person
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-sand-900">
            {editState.displayName || person.displayName}
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
            <span>Notes</span>
            <textarea
              value={editState.notes}
              onChange={(event) =>
                setEditState((current) => ({ ...current, notes: event.target.value }))
              }
              rows={8}
              placeholder="Anything you want the model to remember about this person (relationship, context, preferences, etc.)"
              className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-sand-700">
              <span>Birthday (optional)</span>
              <input
                type="date"
                value={editState.birthday}
                onChange={(event) =>
                  setEditState((current) => ({ ...current, birthday: event.target.value }))
                }
                className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
              />
            </label>

            <label className="grid gap-2 text-sm text-sand-700">
              <span>Aliases (comma separated)</span>
              <input
                value={editState.aliases}
                onChange={(event) =>
                  setEditState((current) => ({ ...current, aliases: event.target.value }))
                }
                placeholder="e.g. nickname, short name"
                className="rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sand-900 outline-none focus:border-sand-400"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm text-sand-700">
            <span>Tags</span>
            <TagInput
              value={editState.tags}
              onChange={(tags) => setEditState((current) => ({ ...current, tags }))}
            />
            <span className="text-xs text-sand-500">
              Pick from your existing tags or type a new one and press Enter. The chat can filter
              by tag (e.g. ask about “family members”).
            </span>
          </label>

          <p className="text-sm text-red-700">{errorMessage ?? "\u00a0"}</p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={status === "saving" || status === "deleting"}
              className="inline-flex items-center justify-center rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "deleting" ? "Deleting..." : "Delete person"}
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

type TagSuggestion = {
  id: string;
  canonicalName: string;
  displayName: string;
};

function TagInput({
  value,
  onChange
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [available, setAvailable] = useState<TagSuggestion[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) return;
        const data = (await response.json()) as { tags?: TagSuggestion[] };
        if (!cancelled && data.tags) {
          setAvailable(data.tags);
        }
      } catch {
        // ignore
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  const selectedKeys = useMemo(
    () => new Set(value.map((tag) => normalizeTagKey(tag))),
    [value]
  );

  const filteredSuggestions = useMemo(() => {
    const term = normalizeTagKey(input);
    return available
      .filter((tag) => !selectedKeys.has(normalizeTagKey(tag.displayName)))
      .filter((tag) =>
        term ? tag.displayName.toLowerCase().includes(term) : true
      )
      .slice(0, 8);
  }, [available, input, selectedKeys]);

  const trimmedInput = input.trim();
  const canCreateNew =
    trimmedInput.length > 0 &&
    !selectedKeys.has(normalizeTagKey(trimmedInput)) &&
    !available.some(
      (tag) => normalizeTagKey(tag.displayName) === normalizeTagKey(trimmedInput)
    );

  const options: Array<
    { kind: "existing"; tag: TagSuggestion } | { kind: "create"; label: string }
  > = [
    ...filteredSuggestions.map((tag) => ({ kind: "existing" as const, tag })),
    ...(canCreateNew ? [{ kind: "create" as const, label: trimmedInput }] : [])
  ];

  useEffect(() => {
    setHighlight(0);
  }, [input, available.length]);

  function addTag(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (selectedKeys.has(normalizeTagKey(trimmed))) {
      setInput("");
      return;
    }
    onChange([...value, trimmed]);
    setInput("");
    setHighlight(0);
  }

  function removeTagAt(index: number) {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => (current - 1 + options.length) % options.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = options[highlight];
      if (option) {
        addTag(option.kind === "existing" ? option.tag.displayName : option.label);
        return;
      }
      if (trimmedInput) {
        addTag(trimmedInput);
      }
      return;
    }

    if (event.key === "," || event.key === "Tab") {
      if (!trimmedInput) return;
      event.preventDefault();
      addTag(trimmedInput);
      return;
    }

    if (event.key === "Backspace" && input.length === 0 && value.length > 0) {
      event.preventDefault();
      removeTagAt(value.length - 1);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-sand-200 bg-white px-3 py-2 focus-within:border-sand-400"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTagAt(index)}
              aria-label={`Remove ${tag}`}
              className="rounded-full text-indigo-500 transition hover:text-indigo-800"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          enterKeyHint="done"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder={value.length === 0 ? "Type or pick a tag..." : ""}
          className="min-w-[6rem] flex-1 bg-transparent px-1 py-1 text-sm text-sand-900 outline-none"
        />
        {trimmedInput ? (
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              addTag(trimmedInput);
              inputRef.current?.focus();
            }}
            className="rounded-full bg-sand-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-sand-800"
          >
            Add
          </button>
        ) : null}
      </div>

      {open && options.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-2xl border border-sand-200 bg-white py-1 text-sm shadow-lg shadow-sand-900/10">
          {options.map((option, index) => {
            const isActive = index === highlight;
            const baseClass = `flex w-full items-center justify-between px-3 py-2 text-left ${
              isActive ? "bg-sand-100 text-sand-900" : "text-sand-700"
            }`;

            if (option.kind === "existing") {
              return (
                <li key={`existing-${option.tag.id}`}>
                  <button
                    type="button"
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => {
                      addTag(option.tag.displayName);
                      inputRef.current?.focus();
                    }}
                    onMouseEnter={() => setHighlight(index)}
                    className={baseClass}
                  >
                    <span>{option.tag.displayName}</span>
                    <span className="text-xs text-sand-400">existing</span>
                  </button>
                </li>
              );
            }

            return (
              <li key="create-new">
                <button
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    addTag(option.label);
                    inputRef.current?.focus();
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={baseClass}
                >
                  <span>Create “{option.label}”</span>
                  <span className="text-xs text-indigo-500">new</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

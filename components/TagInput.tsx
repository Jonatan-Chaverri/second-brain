"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TagSuggestion = {
  id: string;
  canonicalName: string;
  displayName: string;
};

function normalizeTagKey(value: string) {
  return value.trim().toLowerCase();
}

export function TagInput({
  value,
  onChange,
  scope
}: {
  value: string[];
  onChange: (next: string[]) => void;
  scope: "person" | "project";
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
        const response = await fetch(`/api/tags?scope=${scope}`);
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
  }, [scope]);

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

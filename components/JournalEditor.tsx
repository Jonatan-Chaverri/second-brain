"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";

type SaveStatus = "idle" | "loading" | "saved" | "error";

type TodayEntryResponse = {
  entry: {
    id: string;
    rawText: string;
    entryDate: string;
    updatedAt: string;
  } | null;
};

function getLocalDateString() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function splitRawTextIntoBlocks(rawText: string) {
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  const nonEmptyLines = lines.filter((line) => line.length > 0);
  return nonEmptyLines.length > 0 ? [...nonEmptyLines, ""] : [""];
}

function mergeBlocksIntoRawText(blocks: string[]) {
  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join("\n");
}

function normalizeEditorBlocks(nextBlocks: string[]) {
  const nonEmptyBlocks = nextBlocks.map((block) => block.replace(/\r\n/g, "\n")).filter((block) => block.trim().length > 0);
  return [...nonEmptyBlocks, ""];
}

export function JournalEditor() {
  const [blocks, setBlocks] = useState<string[]>([""]);
  const [entryDate, setEntryDate] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const blockRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const blocksContainerRef = useRef<HTMLDivElement | null>(null);

  function autosizeTextarea(textarea: HTMLTextAreaElement | null) {
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  useEffect(() => {
    blockRefs.current.forEach((textarea) => autosizeTextarea(textarea));
    const container = blocksContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [blocks]);

  useEffect(() => {
    const today = getLocalDateString();
    setEntryDate(today);

    async function loadEntry() {
      try {
        const response = await fetch(`/api/journal/today?entryDate=${today}`, {
          method: "GET",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load today's entry.");
        }

        const data = (await response.json()) as TodayEntryResponse;
        setBlocks(splitRawTextIntoBlocks(data.entry?.rawText ?? ""));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
      } finally {
        setLoadingInitial(false);
      }
    }

    void loadEntry();
  }, []);

  async function handleSave() {
    setStatus("loading");
    setErrorMessage(null);
    const rawText = mergeBlocksIntoRawText(blocks);

    try {
      const response = await fetch("/api/journal/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawText,
          entryDate
        })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not save the journal entry.");
      }

      setStatus("saved");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
      return;
    }

    window.setTimeout(() => {
      setStatus("idle");
    }, 1800);
  }

  function focusBlock(index: number) {
    window.requestAnimationFrame(() => {
      const nextBlock = blockRefs.current[index];
      nextBlock?.focus();
      nextBlock?.setSelectionRange(nextBlock.value.length, nextBlock.value.length);
    });
  }

  function updateBlock(index: number, value: string) {
    const normalized = value.replace(/\r\n/g, "\n");

    if (!normalized.includes("\n")) {
      setBlocks((current) => {
        const next = [...current];
        next[index] = normalized;
        return normalizeEditorBlocks(next);
      });
      return;
    }

    const splitValues = normalized.split("\n").map((line) => line.trim());

    setBlocks((current) => {
      const next = [...current];
      const [first, ...rest] = splitValues;
      next[index] = first ?? "";
      next.splice(index + 1, 0, ...rest);
      return normalizeEditorBlocks(next);
    });

    const nextFocusIndex = index + Math.max(splitValues.length - 1, 1);
    focusBlock(nextFocusIndex);
  }

  function removeBlock(index: number) {
    setBlocks((current) => {
      if (current.length <= 1) {
        return [""];
      }

      const next = [...current];
      next.splice(index, 1);
      return normalizeEditorBlocks(next);
    });

    focusBlock(Math.max(index - 1, 0));
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 overflow-hidden px-3 py-2 sm:px-6 sm:py-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white/85 p-3 shadow-lg shadow-sand-900/5 sm:rounded-[2rem] sm:p-5">
        <div className="relative flex items-center justify-center border-b border-sand-100 pb-2">
          <h1 className="text-lg font-bold text-sand-900 sm:text-xl">
            Entry for {entryDate || "today"}
          </h1>
          {status === "loading" || status === "saved" || status === "error" ? (
            <span className="absolute right-0 text-xs text-sand-500">
              {status === "loading" ? "Saving..." : status === "saved" ? "Saved" : "Error"}
            </span>
          ) : null}
        </div>

        <div className="relative mt-3 flex flex-1 overflow-hidden">
          <div ref={blocksContainerRef} className="journal-textarea flex w-full flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-sand-200 bg-sand-50/70 p-2.5 sm:rounded-[1.75rem] sm:p-3">
            {blocks.map((block, index) => (
              <div
                key={`block-${index}`}
                className="flex items-start gap-3 rounded-xl border border-sand-200/80 bg-white/90 px-3 py-2 shadow-sm shadow-sand-900/5 transition-colors focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-300/50"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-indigo-400"
                />
                <textarea
                  ref={(node) => {
                    blockRefs.current[index] = node;
                    autosizeTextarea(node);
                  }}
                  value={block}
                  disabled={loadingInitial}
                  onChange={(event) => {
                    updateBlock(index, event.target.value);
                    autosizeTextarea(event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      focusBlock(Math.min(index + 1, blocks.length - 1));
                    }

                    if (event.key === "Backspace" && block.length === 0) {
                      event.preventDefault();
                      removeBlock(index);
                    }
                  }}
                  placeholder={
                    index === 0
                      ? "Type an idea and press Enter to create the next block."
                      : "New block"
                  }
                  rows={1}
                  className="w-full overflow-hidden resize-none bg-transparent text-sm leading-6 text-sand-900 outline-none placeholder:text-sand-500 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
          {loadingInitial || status === "loading" ? (
            <div
              aria-live="polite"
              aria-busy="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-sand-50/40 backdrop-blur-sm sm:rounded-[1.75rem]"
            >
              <Spinner label={loadingInitial ? "Loading entry" : "Saving entry"} />
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{errorMessage ?? "\u00a0"}</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={loadingInitial || status === "loading" || !entryDate}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] ring-1 ring-inset ring-white/15 transition-all hover:from-indigo-400 hover:to-violet-400 hover:shadow-[0_10px_28px_-6px_rgba(99,102,241,0.7)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {status === "loading" ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving
              </>
            ) : (
              "Save entry"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

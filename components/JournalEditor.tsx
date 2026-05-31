"use client";

import { useEffect, useState } from "react";
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

export function JournalEditor() {
  const [rawText, setRawText] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

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
        setRawText(data.entry?.rawText ?? "");
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
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Write freely. Capture the day, the feeling, the unfinished thought."
            disabled={loadingInitial}
            className="journal-textarea w-full flex-1 resize-none overflow-y-auto rounded-2xl border border-sand-200 bg-sand-50/80 px-4 py-3 text-sm leading-6 text-sand-900 outline-none transition focus:border-sand-400 focus:bg-white disabled:opacity-50 sm:rounded-[1.75rem] sm:px-5 sm:py-4"
          />
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

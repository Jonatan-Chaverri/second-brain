"use client";

import { useEffect, useState } from "react";

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
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 overflow-hidden px-3 py-3 sm:px-6 sm:py-10">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white/85 p-4 shadow-lg shadow-sand-900/5 sm:rounded-[2rem] sm:p-8">
        <div className="flex flex-col gap-2 border-b border-sand-100 pb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-sand-500 sm:text-sm">
              Daily entry
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-sand-900 sm:mt-2 sm:text-3xl">
              Note for {entryDate || "today"}
            </h1>
          </div>
          <div className="text-sm text-sand-600">
            {loadingInitial ? "Loading..." : status === "loading" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Error" : "Ready"}
          </div>
        </div>

        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder="Write freely. Capture the day, the feeling, the unfinished thought."
          className="journal-textarea mt-4 w-full flex-1 resize-none overflow-y-auto rounded-2xl border border-sand-200 bg-sand-50/80 px-4 py-3 text-base leading-7 text-sand-900 outline-none transition focus:border-sand-400 focus:bg-white sm:mt-6 sm:rounded-[1.75rem] sm:px-5 sm:py-4"
        />

        <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{errorMessage ?? "\u00a0"}</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={loadingInitial || status === "loading" || !entryDate}
            className="inline-flex items-center justify-center rounded-full bg-sand-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "Saving..." : "Save entry"}
          </button>
        </div>
      </div>
    </section>
  );
}

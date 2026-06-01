"use client";

import { useEffect, useRef, useState } from "react";

import { ThinkingSprite } from "@/components/ThinkingSprite";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  entriesUsed?: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getBrowserTimeContext() {
  const now = new Date();
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetMins = absoluteOffset % 60;

  return {
    localDate: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    localTime: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
    utcOffset: `${sign}${pad2(offsetHours)}:${pad2(offsetMins)}`
  };
}

export function ChatBox() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pinnedUserIndex, setPinnedUserIndex] = useState<number | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isStreaming = status === "loading";

  useEffect(() => {
    if (pinnedUserIndex === null) {
      return;
    }

    const historyElement = historyRef.current;
    const messageElement = messageRefs.current[pinnedUserIndex];

    if (!historyElement || !messageElement) {
      return;
    }

    // Keep the latest user question pinned near the top while assistant output streams.
    const top = Math.max(messageElement.offsetTop - 8, 0);
    historyElement.scrollTo({
      top,
      behavior: isStreaming ? "auto" : "smooth"
    });
  }, [messages, pinnedUserIndex, isStreaming]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const userMessageIndex = messages.length;
    setPinnedUserIndex(userMessageIndex);
    setMessages((current) => [
      ...current,
      userMessage,
      { role: "assistant", content: "" }
    ]);
    setMessage("");
    setStatus("loading");
    setErrorMessage(null);

    try {
      const browserContext = getBrowserTimeContext();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-6),
          browserContext
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not get a chat response.");
      }

      if (!response.body) {
        throw new Error("Could not stream chat response.");
      }

      const entriesUsed = Number(response.headers.get("X-Entries-Used") ?? "0");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((current) => {
        if (current.length === 0) return current;
        const next = [...current];
        const lastIndex = next.length - 1;
        const last = next[lastIndex];
        if (last.role !== "assistant") return next;
        next[lastIndex] = { ...last, entriesUsed };
        return next;
      });

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        assistantContent += decoder.decode(value, { stream: true });

        setMessages((current) => {
          if (current.length === 0) {
            return current;
          }

          const next = [...current];
          const lastIndex = next.length - 1;
          const last = next[lastIndex];

          if (last.role !== "assistant") {
            return next;
          }

          next[lastIndex] = {
            ...last,
            content: assistantContent,
            entriesUsed
          };

          return next;
        });
      }

      assistantContent += decoder.decode();

      if (!assistantContent.trim()) {
        throw new Error("Could not get a chat response.");
      }
      setStatus("idle");
      setPinnedUserIndex(null);
    } catch (error) {
      setMessages((current) => {
        if (current.length === 0) {
          return current;
        }

        const next = [...current];
        const last = next[next.length - 1];

        if (last.role === "assistant" && last.content.trim().length === 0) {
          next.pop();
        }

        return next;
      });
      setStatus("error");
      setPinnedUserIndex(null);
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 overflow-hidden px-3 py-2 sm:px-6 sm:py-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white/85 p-3 shadow-lg shadow-sand-900/5 sm:rounded-[2rem] sm:p-5">
        <div className="flex items-center justify-center border-b border-sand-100 pb-2">
          <h1 className="text-lg font-bold text-sand-900 sm:text-xl">
            Ask your second brain
          </h1>
        </div>

        <div
          ref={historyRef}
          className="journal-textarea mt-3 flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-sand-200 bg-sand-50/70 p-4 sm:rounded-[1.75rem]"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-sand-500">
              Try asking about a project, a person, or what happened on a specific date.
            </p>
          ) : null}

          {messages.map((entry, index) => (
            <div
              key={`${entry.role}-${index}`}
              ref={(node) => {
                messageRefs.current[index] = node;
              }}
              className={
                entry.role === "user"
                  ? "ml-auto flex max-w-[85%] flex-col items-end gap-1"
                  : "mr-auto flex max-w-[85%] flex-col items-start gap-1"
              }
            >
              <div
                className={
                  entry.role === "user"
                    ? "rounded-3xl bg-sand-900 px-4 py-3 text-sm text-white"
                    : "relative rounded-3xl bg-white px-4 py-3 text-sm text-sand-800 shadow-sm after:absolute after:-bottom-2 after:left-7 after:h-4 after:w-4 after:rotate-45 after:bg-white after:shadow-sm after:content-['']"
                }
              >
                {entry.content || (entry.role === "assistant" ? (
                  <span className="italic text-sand-400">Thinking…</span>
                ) : null)}
                {entry.role === "assistant" && isStreaming && index === messages.length - 1 && entry.content ? (
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-indigo-400 align-[-2px]"
                  />
                ) : null}
              </div>
              {entry.role === "assistant" ? (
                <div className="mt-3 ml-2 flex items-center gap-2">
                  {entry.content.length === 0 ? (
                    <ThinkingSprite size={24} />
                  ) : (
                    <img
                      src="/animations/blink1.png"
                      alt=""
                      aria-hidden
                      className="h-6 w-auto select-none"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                  {entry.entriesUsed !== undefined ? (
                    <span
                      className={
                        entry.entriesUsed > 0
                          ? "rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300 ring-1 ring-inset ring-indigo-400/30"
                          : "rounded-full bg-sand-200/40 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sand-500 ring-1 ring-inset ring-sand-300/40"
                      }
                    >
                      {entry.entriesUsed > 0
                        ? `Basado en ${entry.entriesUsed} ${entry.entriesUsed === 1 ? "entrada" : "entradas"}`
                        : "Sin contexto del diario"}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}

          {isStreaming && pinnedUserIndex !== null ? (
            <div aria-hidden="true" className="h-[45vh] min-h-48 w-full" />
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:mt-5">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder="What have I been focused on lately?"
            className={`${message ? "journal-textarea overflow-y-auto" : "overflow-hidden"} h-11 max-h-32 w-full resize-none rounded-full border border-sand-200 bg-white px-4 py-2.5 text-base leading-6 text-sand-900 outline-none transition focus:border-sand-400`}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-red-700">{errorMessage ?? "\u00a0"}</p>
            <button
              type="submit"
              disabled={status === "loading"}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] ring-1 ring-inset ring-white/15 transition-all hover:from-indigo-400 hover:to-violet-400 hover:shadow-[0_10px_28px_-6px_rgba(99,102,241,0.7)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {status === "loading" ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Thinking
                </>
              ) : (
                "Ask"
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

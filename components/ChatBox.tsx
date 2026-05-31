"use client";

import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatApiResponse = {
  answer: string;
};

export function ChatBox() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setMessage("");
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmed,
          history: messages
        })
      });

      const data = (await response.json()) as Partial<ChatApiResponse> & {
        error?: string;
      };

      if (!response.ok || !data.answer) {
        throw new Error(data.error ?? "Could not get a chat response.");
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.answer
        }
      ]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden px-3 py-3 sm:px-6 sm:py-10">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white/85 p-4 shadow-lg shadow-sand-900/5 sm:rounded-[2rem] sm:p-8">
        <div className="border-b border-sand-100 pb-4 sm:pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-sand-500 sm:text-sm">
            Journal chat
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-sand-900 sm:mt-2 sm:text-3xl">
            Ask your second brain
          </h1>
        </div>

        <div className="journal-textarea mt-4 flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-sand-200 bg-sand-50/70 p-4 sm:mt-6 sm:rounded-[1.75rem]">
          {messages.length === 0 ? (
            <p className="text-sm text-sand-500">
              Try asking about a project, a person, or what happened on a specific date.
            </p>
          ) : null}

          {messages.map((entry, index) => (
            <div
              key={`${entry.role}-${index}`}
              className={
                entry.role === "user"
                  ? "ml-auto max-w-[85%] rounded-3xl bg-sand-900 px-4 py-3 text-sm text-white"
                  : "mr-auto max-w-[85%] rounded-3xl bg-white px-4 py-3 text-sm text-sand-800 shadow-sm"
              }
            >
              {entry.content}
            </div>
          ))}
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
              className="inline-flex items-center justify-center rounded-full bg-sand-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? "Thinking..." : "Ask"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

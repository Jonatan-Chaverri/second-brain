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
          message: trimmed
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
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="rounded-[2rem] border border-sand-200 bg-white/85 p-5 shadow-lg shadow-sand-900/5 sm:p-8">
        <div className="border-b border-sand-100 pb-5">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sand-500">
            Journal chat
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-sand-900">
            Ask your second brain
          </h1>
          <p className="mt-2 text-sm leading-6 text-sand-600">
            Answers are grounded only in the journal entries you have saved so far.
          </p>
        </div>

        <div className="mt-6 flex min-h-[42vh] flex-col gap-3 rounded-[1.75rem] border border-sand-200 bg-sand-50/70 p-4">
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

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What have I been focused on lately?"
            className="min-h-28 w-full rounded-[1.5rem] border border-sand-200 bg-white px-4 py-3 text-base text-sand-900 outline-none transition focus:border-sand-400"
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

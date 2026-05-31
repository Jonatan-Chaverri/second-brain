"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type LoginStatus = "idle" | "loading" | "error";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const unauthorizedMessage = useMemo(() => {
    if (searchParams.get("error") === "unauthorized") {
      return "That email is not allowed to access this second brain.";
    }

    return null;
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("loading");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    router.replace("/journal");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-[2rem] border border-sand-200 bg-white/90 p-8 shadow-xl shadow-sand-900/5 backdrop-blur"
    >
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-sand-500">
          Second Brain
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-sand-900">
          Sign in to your writing space
        </h1>
        <p className="text-sm leading-6 text-sand-600">Access is restricted to the owner account configured on the server.</p>
      </div>

      <label className="mt-8 block text-sm font-medium text-sand-700" htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-base text-sand-900 outline-none transition focus:border-sand-400 focus:bg-white"
        placeholder="you@example.com"
        required
      />

      <label className="mt-4 block text-sm font-medium text-sand-700" htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-base text-sand-900 outline-none transition focus:border-sand-400 focus:bg-white"
        placeholder="••••••••"
        required
      />

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-sand-900 px-4 py-3 text-base font-medium text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Signing in..." : "Sign in"}
      </button>

      <div className="mt-4 min-h-6 text-sm text-sand-600">
        {message ? <p className="text-red-700">{message}</p> : null}
        {!message && unauthorizedMessage ? (
          <p className="text-red-700">{unauthorizedMessage}</p>
        ) : null}
      </div>
    </form>
  );
}

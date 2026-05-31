"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type LoginStatus = "idle" | "loading" | "sent" | "error";

export function LoginForm({ ownerEmail }: { ownerEmail: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(ownerEmail);
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const unauthorizedMessage = useMemo(() => {
    if (searchParams.get("error") === "unauthorized") {
      return "That email is not allowed to access this second brain.";
    }

    if (searchParams.get("error") === "invalid_link") {
      return "That sign-in link is invalid or expired. Request a new one.";
    }

    return null;
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (email.trim().toLowerCase() !== ownerEmail.toLowerCase()) {
      setStatus("error");
      setMessage("Only the configured owner email can sign in.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Magic link sent. Open the email on this device to continue.");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-[2rem] border border-sand-200 bg-white/90 p-8 shadow-xl shadow-sand-900/5 backdrop-blur"
    >
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-sand-500">
          Private Journal
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-sand-900">
          Sign in to your writing space
        </h1>
        <p className="text-sm leading-6 text-sand-600">
          Access is restricted to the owner account configured on the server.
        </p>
      </div>

      <label className="mt-8 block text-sm font-medium text-sand-700" htmlFor="email">
        Owner email
      </label>
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

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-sand-900 px-4 py-3 text-base font-medium text-white transition hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Sending magic link..." : "Send magic link"}
      </button>

      <div className="mt-4 min-h-6 text-sm text-sand-600">
        {message ? <p>{message}</p> : null}
        {!message && unauthorizedMessage ? (
          <p className="text-red-700">{unauthorizedMessage}</p>
        ) : null}
      </div>
    </form>
  );
}

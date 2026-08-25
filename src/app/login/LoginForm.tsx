"use client";

import { FormEvent, useState } from "react";

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || "Sign-in failed. Please try again.");
        return;
      }
      // A full navigation guarantees the newly issued HttpOnly cookie is
      // included in the first authenticated server-rendered request.
      window.location.assign(returnTo);
    } catch {
      setError("The authentication service is unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-800">
        Email address
        <input
          autoComplete="email"
          autoFocus
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Password
        <input
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
      <button
        className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

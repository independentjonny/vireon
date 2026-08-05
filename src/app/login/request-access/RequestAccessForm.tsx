"use client";

import { FormEvent, useState } from "react";

export default function RequestAccessForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/private-beta/access-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), reason: form.get("message"), displayName: form.get("displayName") }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || "Access request could not be saved.");
        return;
      }
      setSuccess(result.message || "Your request has been submitted for review.");
    } catch {
      setError("Request service is unavailable. Please try again.");
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
        Display name
        <input
          autoComplete="name"
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          maxLength={120}
          name="displayName"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Why Vireon?
        <textarea
          className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          maxLength={1200}
          name="message"
          required
        />
      </label>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{success}</div> : null}
      <button
        className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Submitting..." : "Request access"}
      </button>
    </form>
  );
}

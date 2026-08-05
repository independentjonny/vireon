"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type RedeemResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  redirectTo?: string;
  confirmationRequired?: boolean;
};

export default function RedeemInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/private-beta/invitations/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: form.get("token"),
          email: form.get("email"),
          password,
          confirmPassword,
        }),
      });
      const result = (await response.json()) as RedeemResult;
      if (!response.ok || !result.ok) {
        setError(result.error || "Invitation could not be redeemed.");
        return;
      }
      if (result.confirmationRequired) {
        setSuccess(result.message || "Account created. Check your email before signing in.");
        return;
      }
      router.replace(result.redirectTo || "/beta-onboarding");
      router.refresh();
    } catch {
      setError("Invitation service is unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-800">
        Invitation token
        <input
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          defaultValue={token}
          name="token"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Invited email
        <input
          autoComplete="email"
          autoFocus={!token}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Password
        <input
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          minLength={10}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Confirm password
        <input
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          minLength={10}
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{success}</div> : null}
      <button
        className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Creating account..." : "Create beta account"}
      </button>
    </form>
  );
}

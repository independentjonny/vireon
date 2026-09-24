"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function PasswordRecoveryForm({ mode }: { mode: "request" | "update" }) {
  const token = useRef<string | null>(null);
  const initialized = useRef(false);
  const [ready, setReady] = useState(mode === "request");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "update" || initialized.current) return;
    initialized.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    // Consume the provider's implicit recovery redirect once; never persist tokens.
    token.current = fragment.get("type") === "recovery" && fragment.get("token_type") === "bearer" ? fragment.get("access_token") : null;
    window.history.replaceState(null, "", window.location.pathname);
    if (token.current && !fragment.has("error")) setReady(true);
    else setError("This reset link is invalid or expired. Request a new link below.");
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget, data = new FormData(form);
    const password = String(data.get("password") ?? ""), confirmPassword = String(data.get("confirmPassword") ?? "");
    setError(null);
    if (mode === "update" && password !== confirmPassword) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode === "request" ? "forgot-password" : "reset-password"}`, {
        method: "POST", headers: { "content-type": "application/json", ...(mode === "update" && token.current ? { authorization: `Bearer ${token.current}` } : {}) },
        body: JSON.stringify(mode === "request" ? { email: data.get("email") } : { password, confirmPassword }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !result.ok) { setError(result.error || "Please try again."); return; }
      setMessage(result.message || "Request completed.");
      if (mode === "update") token.current = null;
      form.reset();
    } catch { setError("The password-reset service is unavailable. Please try again."); }
    finally { setSubmitting(false); }
  }

  return <>
    {message ? <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{message}</p> :
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {mode === "request" ? <label className="block text-sm font-medium text-slate-800">Email address<input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} /></label> : ready ? <>
          <label className="block text-sm font-medium text-slate-800">New password<input className={inputClass} name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} aria-describedby="password-help" /></label>
          <p id="password-help" className="text-sm text-slate-600">Use at least 10 characters.</p>
          <label className="block text-sm font-medium text-slate-800">Confirm new password<input className={inputClass} name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></label>
        </> : null}
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
        {ready ? <button type="submit" disabled={submitting} className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{submitting ? "Please wait…" : mode === "request" ? "Send reset link" : "Save new password"}</button> : null}
      </form>}
    <div className="mt-6 flex flex-wrap gap-5 text-sm font-semibold text-blue-700">
      <Link className="rounded py-2 underline underline-offset-4" href="/login">Back to sign in</Link>
      {mode === "update" && !message ? <Link className="rounded py-2 underline underline-offset-4" href="/login/forgot-password">Request a new reset link</Link> : null}
    </div>
  </>;
}

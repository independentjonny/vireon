"use client";

import { useEffect, useState } from "react";

type AccessRequest = {
  id: string;
  email: string;
  displayName: string | null;
  reason: string;
  status: string;
  submittedAt: string;
  reviewReason: string | null;
  approvedInvitationId: string | null;
};

type ApiState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; requests: AccessRequest[] };

export default function PrivateBetaAccessAdminClient() {
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [result, setResult] = useState<string | null>(null);
  const [sensitiveLink, setSensitiveLink] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ request: AccessRequest; action: "approve" | "reject" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setState({ status: "loading" });
    const response = await fetch("/api/admin/private-beta/access-requests?status=pending&limit=50", { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as { ok?: boolean; requests?: AccessRequest[]; error?: string };
    if (!response.ok || !body.ok) {
      setState({ status: "error", message: body.error || "Private beta access queue is unavailable." });
      return;
    }
    setState({ status: "ready", requests: body.requests || [] });
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  async function decide() {
    if (!decision || busy) return;
    const { request, action } = decision;
    setBusy(true);
    setResult(null);
    setSensitiveLink(null);
    try {
    const response = await fetch(`/api/admin/private-beta/access-requests/${encodeURIComponent(request.id)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; invitationUrl?: string | null; alreadyApproved?: boolean };
    if (!response.ok || !body.ok) {
      setResult(body.error || "Decision could not be recorded.");
      return;
    }
    setResult(action === "approve" ? "Approved. Copy the invitation link now; it will not be shown again." : "Rejected and audited.");
    if (body.invitationUrl) setSensitiveLink(body.invitationUrl);
    setDecision(null);
    setReason("");
    await load();
    } catch {
      setResult("The decision could not be confirmed. Refresh the queue to check its status before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      {result ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{result}</div> : null}
      {decision ? <form aria-label={decision.action === "approve" ? "Approve access request" : "Reject access request"} onSubmit={event => { event.preventDefault(); void decide(); }} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="font-semibold text-slate-950">{decision.action === "approve" ? "Approve invitation" : "Reject request"}</h2>
        <p className="mt-1 text-sm text-slate-700">{decision.request.email}</p>
        <label className="mt-3 block text-sm font-semibold text-slate-800">{decision.action === "approve" ? "Approval note" : "Rejection reason"}
          <textarea required maxLength={1200} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="mt-1 block min-h-24 w-full rounded border border-slate-300 bg-white p-2" />
        </label>
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={busy || !reason.trim()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : decision.action === "approve" ? "Approve invitation" : "Reject request"}</button>
          <button type="button" disabled={busy} onClick={() => { setDecision(null); setReason(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Cancel</button>
        </div>
      </form> : null}
      {sensitiveLink ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="font-semibold">Sensitive one-time invitation link</div>
          <p className="mt-1">Copy it now. Vireon does not store the raw token and this page will not show it again.</p>
          <input className="mt-3 w-full rounded border border-amber-300 bg-white px-3 py-2 font-mono text-xs" readOnly value={sensitiveLink} />
        </div>
      ) : null}
      {state.status === "loading" ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading access requests...</div> : null}
      {state.status === "error" ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{state.message}</div> : null}
      {state.status === "ready" && state.requests.length === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No pending access requests.</div> : null}
      {state.status === "ready" && state.requests.map((request) => (
        <article key={request.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">{request.displayName || request.email}</div>
              <div className="text-xs text-slate-500">{request.email}</div>
            </div>
            <div className="text-xs font-semibold uppercase text-slate-500">{request.status}</div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{request.reason}</p>
          <div className="mt-4 flex gap-2">
            <button disabled={busy} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { setDecision({ request, action: "approve" }); setReason(""); setSensitiveLink(null); }}>Approve</button>
            <button disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={() => { setDecision({ request, action: "reject" }); setReason(""); setSensitiveLink(null); }}>Reject</button>
          </div>
        </article>
      ))}
    </section>
  );
}

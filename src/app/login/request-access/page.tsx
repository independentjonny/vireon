import Link from "next/link";
import AppShell from "../../components/AppShell";
import RequestAccessForm from "./RequestAccessForm";

export const dynamic = "force-dynamic";

export default function RequestAccessPage() {
  return (
    <AppShell active="dashboard">
      <main className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="text-xs font-semibold uppercase text-blue-700">Manual approval</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Request access</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Vireon private beta is invite-only. Requests are recorded for manual review and do not automatically create or send invitations.
        </p>
        <RequestAccessForm />
        <Link className="mt-5 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900" href="/login">
          Back to sign in
        </Link>
      </main>
    </AppShell>
  );
}

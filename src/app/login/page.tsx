import AppShell from "../components/AppShell";
import LoginForm from "./LoginForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = typeof params.returnTo === "string" && params.returnTo.startsWith("/") && !params.returnTo.startsWith("/api/")
    ? params.returnTo
    : "/";

  return (
    <AppShell active="dashboard">
      <main className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="text-xs font-semibold uppercase text-blue-700">Authentication required</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Sign in to Vireon</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This workspace requires a verified Supabase session before financial data or operational tools can load.
        </p>
        <LoginForm returnTo={returnTo} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
            href="/login/redeem-invitation"
          >
            Redeem invitation
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            href="/login/request-access"
          >
            Request access
          </Link>
        </div>
        <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          Return path after sign-in: <span className="font-mono text-slate-800">{returnTo}</span>
        </div>
      </main>
    </AppShell>
  );
}

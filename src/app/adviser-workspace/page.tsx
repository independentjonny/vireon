import AppShell from "../components/AppShell";
import { buildFinancialDigitalTwinFromVault } from "@/lib/financialDigitalTwin";
import { buildAdviserWorkspace } from "@/lib/productUpgradeProgram";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

export default async function AdviserWorkspacePage() {
  const session = await requireServerPageSession();
  const vault = (await createFinancialPositionReadServiceFromEnv().read(session)).vault;
  const workspace = buildAdviserWorkspace(vault, buildFinancialDigitalTwinFromVault(vault));
  return <AppShell active="workspace"><main className="mx-auto max-w-7xl space-y-5">
    <header className="rounded-lg border border-slate-200 bg-white p-6"><div className="text-xs font-semibold uppercase text-blue-700">Professional Mode</div><h1 className="mt-2 text-3xl font-semibold">Adviser workspace</h1><p className="mt-2 text-sm text-slate-600">A read-only, evidence-backed client view for review and collaboration.</p></header>
    <section className="grid gap-3 md:grid-cols-5">{Object.entries(workspace.clientSummary).map(([label,value]) => <article key={label} className="rounded-lg border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{label.replace(/[A-Z]/g, m => ` ${m}`).trim()}</div><div className="mt-2 text-xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</div></article>)}</section>
    <section className="grid gap-5 lg:grid-cols-2"><article className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold">Review queue</h2><div className="mt-4 space-y-2">{workspace.reviewQueue.length ? workspace.reviewQueue.map(item => <div key={item} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{item}</div>) : <div className="text-sm text-emerald-700">No material review flags.</div>}</div></article><article className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold">Evidence index</h2><div className="mt-4 space-y-2">{workspace.evidenceIndex.map(item => <div key={item.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{item.title}</span><span className="text-slate-500">{Math.round(item.confidence*100)}% - {item.status}</span></div>)}</div></article></section>
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">{workspace.disclosure}</div>
  </main></AppShell>;
}

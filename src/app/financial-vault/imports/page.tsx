import AppShell from "../../components/AppShell";
import ManualImportWorkspaceClient from "../../components/ManualImportWorkspaceClient";
import Link from "next/link";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { DOCUMENT_TYPE_LABELS, type ProfileValueKey } from "@/lib/financialVaultTypes";
import { createFinancialVaultServiceFromEnv } from "@/server/services/financialVaultPostgresService";
export const dynamic="force-dynamic";

const profileLabels: Record<ProfileValueKey, string> = {
  incomeMonthly: "Monthly income", incomeAnnual: "Annual income", employmentType: "Employment type", employerName: "Employer",
  mortgageBalance: "Mortgage balance", mortgageRepaymentMonthly: "Monthly mortgage repayment", interestRate: "Interest rate",
  superBalance: "Super balance", monthlySpending: "Monthly spending", recurringSubscriptions: "Recurring subscriptions",
  liabilities: "Liabilities", assets: "Assets",
};

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ documentId?: string }> }) {
  const { documentId } = await searchParams;
  if (!documentId) return <AppShell active="financial-vault"><main className="mx-auto max-w-7xl space-y-5"><ManualImportWorkspaceClient/></main></AppShell>;
  const session = await requireServerPageSession(`/financial-vault/imports?documentId=${encodeURIComponent(documentId)}`);
  const vault = await createFinancialVaultServiceFromEnv().getVault(session);
  const document = vault.uploaded_documents.find((item) => item.id === documentId);
  const sourcedValues = Object.entries(vault.financial_profile.sources)
    .filter(([, source]) => source?.documentId === documentId)
    .map(([key]) => [key as ProfileValueKey, vault.financial_profile[key as ProfileValueKey]] as const);

  return <AppShell active="financial-vault"><main className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Document Vault</div>
      <h1 className="mt-2 text-3xl font-semibold">Document evidence review</h1>
      <p className="mt-2 text-sm text-slate-600">Review the selected source and every value Vireon linked to it.</p>
    </header>
    {!document ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">This document could not be found in your Vault.</section> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{document.fileName}</h2><p className="mt-1 text-sm text-slate-500">{DOCUMENT_TYPE_LABELS[document.documentType]} · {Math.round(document.extractionConfidence * 100)}% extraction confidence</p></div><span className={"rounded-full px-3 py-1 text-xs font-semibold " + (document.status === "extracted" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{document.status === "extracted" ? "Verified" : document.status.replace("_", " ")}</span></div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Values linked to this document</h2><div className="mt-4 space-y-3">{sourcedValues.length ? sourcedValues.map(([key, value]) => <div key={key} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"><span className="text-sm text-slate-600">{profileLabels[key]}</span><span className="font-semibold text-slate-950">{typeof value === "number" ? value.toLocaleString("en-AU") : String(value)}</span></div>) : <p className="text-sm text-slate-600">No Financial Position values are linked to this document yet.</p>}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Extracted source text</h2><pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{document.extractedText || "No extractable text was stored for this document."}</pre></section>
      </div>
      <div className="flex justify-end"><Link href="/financial-profile" className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white">Back to Financial Position</Link></div>
    </>}
  </main></AppShell>;
}

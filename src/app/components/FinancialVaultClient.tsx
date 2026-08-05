"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  PiggyBank,
  ShieldCheck,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  REQUIRED_DOCUMENTS,
  type DocumentType,
  type FinancialProfile,
  type FinancialVaultState,
  type ProfileValueKey,
  type SourceTrace,
} from "@/lib/financialVaultTypes";

const documentTypes = Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][];

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value || 0);
}

function pct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function metricValue(value: number, ready: boolean, compact = false) {
  return ready ? money(value, compact) : "Not calculated yet";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "extracted") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "needs_review") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-100";
  if (status === "processing") return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function sourceLine(source?: SourceTrace) {
  if (!source) return "Source: not verified by document";
  return `Source: ${DOCUMENT_TYPE_LABELS[source.documentType]} uploaded ${dateLabel(source.uploadedAt)}`;
}

function confidenceScore(profile: FinancialProfile, documents: FinancialVaultState["uploaded_documents"]) {
  const sourceCount = Object.keys(profile.sources).length;
  const extractedDocs = documents.filter((doc) => doc.status === "extracted").length;
  return Math.min(98, Math.round(sourceCount * 6.5 + extractedDocs * 6));
}

function FieldCard({ label, value, source }: { label: string; value: string; source?: SourceTrace }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
      <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{sourceLine(source)}</div>
    </div>
  );
}

function ProfileGrid({ profile }: { profile: FinancialProfile }) {
  const source = (key: ProfileValueKey) => profile.sources[key];
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <FieldCard label="Income" value={`${money(profile.incomeAnnual)}/year`} source={source("incomeAnnual")} />
      <FieldCard label="Employment" value={profile.employmentType || "Needs review"} source={source("employmentType")} />
      <FieldCard label="Employer" value={profile.employerName || "Needs review"} source={source("employerName")} />
      <FieldCard label="Assets" value={money(profile.assets)} source={source("assets")} />
      <FieldCard label="Liabilities" value={money(profile.liabilities)} source={source("liabilities")} />
      <FieldCard label="Mortgage" value={money(profile.mortgageBalance)} source={source("mortgageBalance")} />
      <FieldCard label="Interest Rate" value={pct(profile.interestRate)} source={source("interestRate")} />
      <FieldCard label="Super" value={money(profile.superBalance)} source={source("superBalance")} />
      <FieldCard label="Monthly Cashflow" value={money(profile.incomeMonthly - profile.monthlySpending - profile.mortgageRepaymentMonthly)} source={source("monthlySpending")} />
      <FieldCard label="Recurring Expenses" value={`${money(profile.recurringSubscriptions)}/mo`} source={source("recurringSubscriptions")} />
    </section>
  );
}

function downloadJson(vault: FinancialVaultState) {
  const blob = new Blob([JSON.stringify(vault.lender_pack, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vireon-lender-pack-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinancialVaultClient({ initialVault }: { initialVault: FinancialVaultState | null }) {
  const [vault, setVault] = useState<FinancialVaultState | null>(initialVault);
  const [selectedType, setSelectedType] = useState<DocumentType>("bank_statement");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPack, setShowPack] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadVault = useCallback(() => {
    let cancelled = false;
    fetch("/api/financial-vault")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.vault) setVault(data.vault);
        if (!cancelled && !data.vault && data.error) setError(data.error);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the Financial Vault from PostgreSQL.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return loadVault();
  }, [loadVault]);

  const profileConfidence = useMemo(() => {
    if (!vault) return 0;
    return confidenceScore(vault.financial_profile, vault.uploaded_documents);
  }, [vault]);

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("documentType", selectedType);

    try {
      const res = await fetch("/api/financial-vault", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setVault(data.vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (!vault) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-600">
        {!error && <Loader2 className="h-5 w-5 animate-spin" />}
        <div>{error ?? "Loading Financial Vault"}</div>
        {error ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              loadVault();
            }}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Retry loading Vault
          </button>
        ) : null}
      </div>
    );
  }

  const missingDocs = REQUIRED_DOCUMENTS.filter(
    (item) => !vault.uploaded_documents.some((doc) => doc.documentType === item.documentType && doc.status === "extracted")
  );
  const availableDocumentCount = REQUIRED_DOCUMENTS.length - missingDocs.length;
  const documentReadinessScore = Math.round((availableDocumentCount / REQUIRED_DOCUMENTS.length) * 100);
  const refinance = vault.refinance_opportunities[0];
  const hasUploadedDocuments = vault.uploaded_documents.length > 0;
  const hasIncomeAndSpending = Boolean(vault.financial_profile.sources.incomeAnnual && vault.financial_profile.sources.monthlySpending);
  const hasMortgageEvidence = Boolean(vault.financial_profile.sources.mortgageBalance || vault.financial_profile.sources.mortgageRepaymentMonthly);
  const summaryCards = [
    { label: "Documents", value: vault.uploaded_documents.length.toString(), note: "Persisted in PostgreSQL", Icon: FileText },
    { label: "Borrowing", value: metricValue(vault.borrowing_capacity.estimatedSafeBorrowing, hasIncomeAndSpending, true), note: hasIncomeAndSpending ? "Safer estimate" : "Add income and spending", Icon: Landmark },
    { label: "Surplus", value: metricValue(vault.borrowing_capacity.surplusIncome, hasIncomeAndSpending), note: hasIncomeAndSpending ? "Monthly estimate" : "Needs income and expenses", Icon: WalletCards },
    { label: "Refinance", value: refinance ? money(refinance.estimatedMonthlySaving) : "Not calculated yet", note: hasMortgageEvidence ? "Potential monthly saving" : "Add mortgage statement", Icon: PiggyBank },
    { label: "Document Readiness", value: `${documentReadinessScore}%`, note: `${availableDocumentCount}/${REQUIRED_DOCUMENTS.length} required documents`, Icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            PostgreSQL-backed Financial Profile Vault
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Financial Vault</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Upload lender documents once. Vireon extracts a traceable profile, estimates borrowing capacity, and prepares a lender-ready package from persisted Vault metadata.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
            <div className="text-xs font-semibold uppercase text-slate-500">Profile confidence</div>
            <div className="mt-1 text-3xl font-semibold text-slate-950">{profileConfidence}%</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
            <div className="text-xs font-semibold uppercase text-slate-500">Document readiness</div>
            <div className="mt-1 text-3xl font-semibold text-slate-950">{documentReadinessScore}%</div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, note, Icon }) => (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
                <div className="mt-2 text-sm text-slate-500">{note}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <h2 className="text-lg font-semibold text-slate-950">Upload documents</h2>
          <p className="mt-1 text-sm text-slate-500">Upload PDF, CSV, payslip, tax-return, mortgage, or super documents. Scanned PDFs are held for review when no text layer is available.</p>
          <label className="mb-3 mt-5 block text-sm font-semibold text-slate-700" htmlFor="documentType">
            Document type
          </label>
          <select
            id="documentType"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as DocumentType)}
            className="mb-4 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-400"
          >
            {documentTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files.item(0);
              if (file) void uploadFile(file);
            }}
            onDragOver={(event) => event.preventDefault()}
            className="flex min-h-[190px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-6 text-center transition hover:border-blue-300 hover:bg-blue-50"
          >
            <UploadCloud className="h-9 w-9 text-blue-600" />
            <span className="mt-4 text-base font-semibold text-slate-950">Drag a document here or browse</span>
            <span className="mt-2 text-sm leading-6 text-slate-500">Document metadata and reviewed extraction state are persisted. No bank integration or external AI processing is used.</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.txt,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
              event.currentTarget.value = "";
            }}
          />
          {busy && <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-blue-700"><Loader2 className="h-4 w-4 animate-spin" /> Persisting to Vault</div>}
          {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <h2 className="text-lg font-semibold text-slate-950">Uploaded document list</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {hasUploadedDocuments ? vault.uploaded_documents.map((doc) => (
              <div key={doc.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{doc.fileName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {DOCUMENT_TYPE_LABELS[doc.documentType]} - uploaded {dateLabel(doc.uploadedAt)} - confidence {Math.round(doc.extractionConfidence * 100)}%
                  </div>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(doc.status)}`}>
                  {doc.status.replace("_", " ")}
                </span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm leading-6 text-slate-600">
                No documents have been uploaded yet. Start with a payslip or bank statement to unlock profile confidence, cash-flow estimates and evidence-backed recommendations.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Financial Profile Vault</h2>
            <p className="mt-1 text-sm text-slate-500">Every value keeps its source document visible before it updates the lender profile.</p>
          </div>
          <div className="text-sm font-semibold text-slate-600">Last updated {dateLabel(vault.financial_profile.lastUpdatedAt)}</div>
        </div>
        <ProfileGrid profile={vault.financial_profile} />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <h2 className="text-lg font-semibold text-slate-950">Borrowing capacity estimate</h2>
          {hasIncomeAndSpending ? (
            <div className="mt-5 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Estimated max borrowing</div>
              <div className="mt-1 text-3xl font-semibold text-slate-950">{money(vault.borrowing_capacity.estimatedMaxBorrowing)}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4">
              <div className="text-sm font-semibold text-emerald-800">Safer range</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-900">{money(vault.borrowing_capacity.estimatedSafeBorrowing)}</div>
            </div>
            <div className="text-sm leading-6 text-slate-600">
              Monthly repayment estimate: <span className="font-semibold text-slate-950">{money(vault.borrowing_capacity.monthlyRepaymentAtCurrentRates)}</span>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              Estimates are for planning only and are not financial, tax, credit, or lending advice.
            </div>
          </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-slate-600">
              Borrowing estimates are not calculated yet. Confirm income and recurring spending first so Vireon does not show a misleading zero or overstate capacity.
            </p>
          )}
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <h2 className="text-lg font-semibold text-slate-950">Refinance opportunities</h2>
          {refinance ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FieldCard label="Current rate" value={pct(refinance.currentRate)} />
                <FieldCard label="Benchmark" value={pct(refinance.benchmarkRate)} />
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-sm font-semibold text-blue-800">Estimated saving</div>
                <div className="mt-1 text-2xl font-semibold text-blue-950">{money(refinance.estimatedMonthlySaving)}/mo</div>
                <div className="mt-1 text-sm text-blue-700">{money(refinance.estimatedAnnualSaving)}/year</div>
              </div>
              <p className="text-sm leading-6 text-slate-600">{refinance.notes.join(" ")}</p>
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-slate-500">Upload a mortgage statement to estimate refinance savings.</p>
          )}
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <h2 className="text-lg font-semibold text-slate-950">Savings opportunities</h2>
          <div className="mt-5 space-y-4">
            {vault.savings_opportunities.length ? vault.savings_opportunities.map((opportunity) => (
              <div key={`${opportunity.category}-${opportunity.description}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{opportunity.category}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">{opportunity.description}</div>
                  </div>
                  <div className="text-right text-sm font-semibold text-emerald-700">{money(opportunity.monthlySaving)}/mo</div>
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-500">{opportunity.action}</div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm leading-6 text-slate-600">
                No savings opportunities are ready yet. Confirm recurring expenses or import recent transactions to let Vireon compare spending patterns safely.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Lender-ready package</h2>
            <p className="mt-1 text-sm text-slate-500">Generate an HTML/JSON-ready summary with document checklist, assumptions, and risk flags.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowPack((value) => !value)}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
            >
              Generate Lender Pack
            </button>
            <button type="button" onClick={() => downloadJson(vault)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#10243b] px-5 text-sm font-semibold text-white">
              <ArrowDownToLine className="h-4 w-4" />
              JSON
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          {vault.lender_pack.documentChecklist.map((item) => (
            <div key={item.documentType} className={`rounded-lg border p-3 ${item.available ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {item.available ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {showPack && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-950">Summary</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p>{vault.lender_pack.incomeSummary}</p>
                <p>{vault.lender_pack.assetSummary}</p>
                <p>{vault.lender_pack.liabilitySummary}</p>
                <p>{vault.lender_pack.cashflowSummary}</p>
                <p>{vault.lender_pack.mortgageRefinanceSummary}</p>
              </div>
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-5 text-xs leading-5 text-slate-100">
              {JSON.stringify(vault.lender_pack, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Estimates are for planning only and are not financial, tax, credit, or lending advice. Open Banking and live AI remain disabled.
      </section>
    </div>
  );
}

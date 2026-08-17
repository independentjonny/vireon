import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import type { FinancialPositionReadModel } from "@/server/services/financialPositionReadService";

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function numericValue(record: CanonicalFinancialRecord, keys: string[]) {
  for (const key of keys) {
    const raw = record.value[key];
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[$,\s]/g, "")) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function total(records: CanonicalFinancialRecord[], keys: string[]) {
  const values = records.map((record) => numericValue(record, keys)).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function MetricCard({ label, value, icon: Icon, available }: { label: string; value: string; icon: LucideIcon; available: boolean }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-700">{label}</div>
          <div className={"mt-2 text-2xl font-semibold tracking-tight " + (available ? "text-slate-950" : "text-slate-500")}>{value}</div>
        </div>
        <div className={"flex h-11 w-11 items-center justify-center rounded-full " + (available ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-500">{available ? "Confirmed data only" : "Waiting for confirmed data"}</div>
    </article>
  );
}

type Gap = {
  title: string;
  detail: string;
  status: "Missing" | "Needs review" | "Stale";
  action: string;
  href: string;
  icon: LucideIcon;
};

export default function FinancialProfileBuilderClient({ position, savedProperty = false }: { position: FinancialPositionReadModel; savedProperty?: boolean }) {
  const assets = total(position.assets, ["marketValue", "balance", "amount", "value"]);
  const liabilities = total(position.liabilities, ["balance", "amount", "principal", "value"]);
  const income = total(position.income, ["monthlyAmount", "monthlyIncome", "amount"]);
  const expenses = total(position.expenses, ["monthlyAmount", "monthlyExpense", "amount"]);
  const netWorth = assets !== null && liabilities !== null ? assets - liabilities : null;
  const monthlyCashFlow = income !== null && expenses !== null ? income - expenses : null;
  const cash = position.cashPosition.sourceRecordIds.length ? position.cashPosition.confirmedCash : null;
  const property = total(position.propertyDetails, ["marketValue", "balance", "amount", "value"]);
  const superannuation = total(position.superannuation, ["balance", "marketValue", "amount", "value"]);
  const homeLoans = total(position.mortgageDetails, ["balance", "amount", "principal", "value"]);
  const mortgageIds = new Set(position.mortgageDetails.map((record) => record.id));
  const otherDebt = total(position.liabilities.filter((record) => !mortgageIds.has(record.id)), ["balance", "amount", "principal", "value"]);
  const needsReview = position.documentImportStatus.unresolvedExtractionReviewCount + position.confidenceSummary.lowConfidenceFactCount;
  const confirmedSources = position.provenanceSummary.sourceRecordIds.length;

  const gapCandidates: Gap[] = [
    ...(position.income.length === 0
      ? [{ title: "Employment income needs confirmation", detail: "Confirm your current income to strengthen borrowing and cash-flow guidance.", status: "Needs review" as const, action: "Review income", href: "/cash-flow", icon: Banknote }]
      : []),
    ...(position.expenses.length === 0
      ? [{ title: "Living expenses are incomplete", detail: "Add confirmed recurring expenses to improve cash-flow accuracy.", status: "Missing" as const, action: "Review expenses", href: "/cash-flow", icon: WalletCards }]
      : []),
    ...(position.superannuation.length === 0
      ? [{ title: "Superannuation balance is missing", detail: "Add current evidence so retirement savings are included in your position.", status: "Missing" as const, action: "Review evidence", href: "/financial-vault", icon: FileCheck2 }]
      : []),
    ...(position.staleDataSummary.staleFactCount > 0
      ? [{ title: `${position.staleDataSummary.staleFactCount} confirmed value${position.staleDataSummary.staleFactCount === 1 ? " is" : "s are"} out of date`, detail: "Refresh stale evidence to keep your financial position current.", status: "Stale" as const, action: "Refresh evidence", href: "/financial-vault", icon: RefreshCw }]
      : []),
    ...(position.propertyDetails.length === 0
      ? [{ title: "Property details are not confirmed", detail: "Confirm ownership and current property values before relying on equity guidance.", status: "Missing" as const, action: "Add property", href: "/financial-profile/add-data?category=property", icon: Building2 }]
      : []),
    ...(position.liabilities.length === 0
      ? [{ title: "Loan balances are not confirmed", detail: "Confirm current liabilities before Vireon calculates net worth.", status: "Missing" as const, action: "Add loan details", href: "/financial-profile/add-data?category=loans", icon: Landmark }]
      : []),
  ];
  const gaps = gapCandidates.slice(0, 3);
  const primary = gaps[0] ?? {
    title: "Review your confirmed financial position",
    detail: "Your core information is present. Check the source evidence and freshness before making a decision.",
    status: "Needs review" as const,
    action: "Review sources",
    href: "/financial-vault",
    icon: ShieldCheck,
  };

  const summary = [
    { label: "Property", value: property, icon: Building2, href: "/financial-profile/property" },
    { label: "Cash & savings", value: cash, icon: WalletCards, href: "/accounts" },
    { label: "Superannuation", value: superannuation, icon: CircleDollarSign, href: "/financial-vault" },
    { label: "Home loans", value: homeLoans, icon: Landmark, href: "/financial-profile/property#mortgage" },
    { label: "Other debt", value: otherDebt, icon: Banknote, href: "/balance-sheet" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-7 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Financial profile</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Your financial position</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">A confirmed view of what Vireon knows, what matters most, and what to do next.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Updated {dateLabel(position.profileSummary.lastUpdatedAt)}
        </div>
      </header>

      {savedProperty ? (
        <section role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <div className="font-semibold">Property and mortgage details saved</div>
            <p className="mt-1 text-sm text-emerald-800">Your confirmed current information is included below. Any supporting documents remain in Document Vault for evidence review.</p>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="known-heading">
        <h2 id="known-heading" className="text-xl font-semibold tracking-tight text-slate-950">What Vireon knows</h2>
        <span className="sr-only">What does Vireon know?</span>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Net worth" value={netWorth === null ? "Unavailable" : money(netWorth)} icon={CircleDollarSign} available={netWorth !== null} />
          <MetricCard label="Assets" value={assets === null ? "Unavailable" : money(assets)} icon={WalletCards} available={assets !== null} />
          <MetricCard label="Liabilities" value={liabilities === null ? "Unavailable" : money(liabilities)} icon={Landmark} available={liabilities !== null} />
          <MetricCard label="Monthly cash flow" value={monthlyCashFlow === null ? "Unavailable" : `${monthlyCashFlow >= 0 ? "+" : ""}${money(monthlyCashFlow)}`} icon={Banknote} available={monthlyCashFlow !== null} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-6">
            <h3 className="text-base font-semibold text-slate-950">Position summary</h3>
            <div className="mt-4 divide-y divide-slate-100">
              {summary.map((item) => (
                <Link key={item.label} href={item.href} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"><item.icon className="h-4 w-4" /></div>
                  <span className="flex-1 text-sm font-medium text-slate-700 group-hover:text-blue-700">{item.label}</span>
                  <span className={"text-sm font-semibold " + (item.value === null ? "text-slate-400" : "text-slate-950")}>{item.value === null ? "Not confirmed" : money(item.value)}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600" />
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-6">
            <h3 className="text-base font-semibold text-slate-950">Coverage</h3>
            <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200 rounded-xl bg-slate-50 p-4">
              <div className="pr-4"><div className="text-2xl font-semibold text-slate-950">{confirmedSources}</div><div className="mt-1 text-xs font-semibold text-slate-700">Confirmed sources</div></div>
              <div className="pl-4"><div className="text-2xl font-semibold text-slate-950">{needsReview}</div><div className="mt-1 text-xs font-semibold text-slate-700">Need review</div></div>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              <div className="flex items-center gap-3 py-3"><Clock3 className="h-5 w-5 text-slate-500" /><div className="flex-1"><div className="text-sm font-semibold text-slate-800">Data freshness</div><div className="mt-0.5 text-xs text-slate-500">{position.staleDataSummary.staleFactCount ? `${position.staleDataSummary.staleFactCount} value${position.staleDataSummary.staleFactCount === 1 ? "" : "s"} need refreshing` : "Confirmed values are current"}</div></div></div>
              <div className="flex items-center gap-3 py-3"><ShieldCheck className="h-5 w-5 text-slate-500" /><div className="flex-1"><div className="text-sm font-semibold text-slate-800">Provenance</div><div className="mt-0.5 text-xs text-slate-500">Every displayed value remains linked to its source</div></div><Link href="/financial-vault" className="text-xs font-semibold text-blue-700">View sources</Link></div>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="missing-heading">
        <div className="flex items-end justify-between gap-4">
          <div><h2 id="missing-heading" className="text-xl font-semibold tracking-tight text-slate-950">What is importantly missing</h2><p className="mt-1 text-sm text-slate-500">Missing means Vireon does not yet have a confirmed current record. It never means zero.</p></div>
          <div className="hidden text-xs font-semibold text-slate-500 sm:block">{gapCandidates.length} material gap{gapCandidates.length === 1 ? "" : "s"}</div>
        </div>
        <article className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
          {gaps.length ? gaps.map((gap) => {
            const statusClass = gap.status === "Missing" ? "bg-rose-50 text-rose-700" : gap.status === "Stale" ? "bg-orange-50 text-orange-700" : "bg-amber-50 text-amber-700";
            return <div key={gap.title} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
              <div className="flex min-w-0 flex-1 items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"><gap.icon className="h-4 w-4" /></div><div><div className="font-semibold text-slate-900">{gap.title}</div><div className="mt-1 text-sm leading-5 text-slate-500">{gap.detail}</div></div></div>
              <span className={"self-start rounded-full px-3 py-1 text-xs font-semibold sm:self-auto " + statusClass}>{gap.status}</span>
              <Link href={gap.href} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">{gap.action}<ArrowRight className="h-4 w-4" /></Link>
            </div>;
          }) : <div className="p-5 text-sm text-slate-600">No material gaps are currently identified. Review source freshness before relying on this position.</div>}
        </article>
      </section>

      <section aria-labelledby="next-heading" className="flex flex-col gap-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Sparkles className="h-6 w-6" /></div>
          <div><div className="text-sm font-semibold text-blue-700">What should I do next?</div><h2 id="next-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{primary.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{primary.detail}</p></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={primary.href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800">{primary.action}<ArrowRight className="h-4 w-4" /></Link>
          <Link href="/financial-vault" className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100/70">View all gaps</Link>
        </div>
      </section>

      <details className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-[0_10px_30px_rgba(15,23,42,0.035)]">
        <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-slate-800"><ShieldCheck className="h-5 w-5 text-slate-500" /><span className="flex-1">How this was calculated</span><ArrowRight className="h-4 w-4 rotate-90 text-slate-400 transition group-open:-rotate-90" /></summary>
        <p className="mt-3 pl-8 leading-6 text-slate-600">Figures use confirmed current records only. Unknown inputs stay unavailable, confirmed zero remains zero, and every value retains its source and freshness information.</p>
      </details>
    </div>
  );
}

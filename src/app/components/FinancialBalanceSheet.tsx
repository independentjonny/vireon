"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  Banknote,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Home,
  Landmark,
  LineChart,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type {
  BalanceSheetCategory,
  BalanceSheetCategoryId,
  BalanceSheetSource,
  FinancialBalanceSheet as FinancialBalanceSheetData,
} from "@/lib/financialBalanceSheet";

const categoryIcons: Record<BalanceSheetCategoryId, ElementType> = {
  cash: WalletCards,
  property: Home,
  investments: LineChart,
  superannuation: PiggyBank,
  mortgages: Landmark,
  "credit-cards": CreditCard,
  "personal-car-loans": Building2,
  "other-debt": Banknote,
};

const statusClass = {
  healthy: "border-emerald-100 bg-emerald-50 text-emerald-700",
  excellent: "border-blue-100 bg-blue-50 text-blue-700",
  good: "border-teal-100 bg-teal-50 text-teal-700",
  moderate: "border-amber-100 bg-amber-50 text-amber-700",
  review: "border-orange-100 bg-orange-50 text-orange-700",
} as const;

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function sourceTitle(source: BalanceSheetSource) {
  return `Source: ${source.label}\nLast updated: ${new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(source.updatedAt))}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
      <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold leading-none text-slate-950">{value}</div>
      {note && <div className="mt-2 text-xs leading-5 text-slate-500">{note}</div>}
    </div>
  );
}

function Trend({ category }: { category: BalanceSheetCategory }) {
  const positive = category.trend.value >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <TrendIcon className={positive ? "h-3.5 w-3.5 text-emerald-600" : "h-3.5 w-3.5 text-orange-600"} />
      <span>{category.trend.period}</span>
      <span className={positive ? "text-emerald-700" : "text-orange-700"}>{category.trend.label}</span>
    </div>
  );
}

function CategoryCard({
  category,
  expanded,
  onToggle,
  accent,
}: {
  category: BalanceSheetCategory;
  expanded: boolean;
  onToggle: () => void;
  accent: "green" | "red";
}) {
  const Icon = categoryIcons[category.id];
  const accentClass = accent === "green" ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500";
  const iconClass = accent === "green" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  return (
    <article className={`rounded-lg border border-slate-200 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.04)] ${accentClass}`}>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
            <Icon className="h-5 w-5" strokeWidth={2.15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950">{category.label}</h3>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass[category.statusTone]}`}>
                {category.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <div title={sourceTitle(category.source)} className="cursor-help text-2xl font-semibold leading-none text-slate-950">
                {money(category.value, category.value >= 1000000)}
              </div>
              <div className={category.monthlyChange >= 0 ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-orange-600"}>
                {category.monthlyChange >= 0 ? "+" : ""}
                {money(category.monthlyChange)} this month
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-[10px] font-semibold uppercase text-slate-500">Accounts</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{category.accountCount} {category.accountCount === 1 ? "Account" : "Accounts"}</div>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-[10px] font-semibold uppercase text-slate-500">{category.primaryMetric.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{category.primaryMetric.value}</div>
              </div>
              <div className="rounded-md bg-slate-50 p-2">
                <div className="text-[10px] font-semibold uppercase text-slate-500">{category.healthIndicator.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{category.healthIndicator.status}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Trend category={category} />
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Source: {category.source.label}
              </span>
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Updated {shortDate(category.source.updatedAt)}
              </span>
              {category.secondaryMetric && (
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {category.secondaryMetric.label}: {category.secondaryMetric.value}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
        <div className="flex gap-2 text-sm leading-6 text-blue-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 fill-blue-600 text-blue-600" />
          <span>{category.aiInsight}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="space-y-3">
            {category.accounts.length > 0 ? (
              category.accounts.map((account) => (
                <div key={account.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{account.name}</div>
                      <div title={sourceTitle(account.source)} className="mt-1 cursor-help text-lg font-semibold text-slate-950">
                        {money(account.value)}
                      </div>
                    </div>
                    <Link href={`/balance-sheet/${category.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800">
                      Open page
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {account.details.map((detail) => (
                      <div key={`${account.id}-${detail.label}`} className="rounded-md bg-white p-2">
                        <div className="text-[10px] font-semibold uppercase text-slate-500">{detail.label}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">{detail.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
                No active accounts in this category.
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3 text-white">
            <span className="text-sm font-semibold">{category.label} total</span>
            <span className="text-lg font-semibold">{money(category.value)}</span>
          </div>
        </div>
      )}
    </article>
  );
}

function CategoryColumn({
  title,
  total,
  categories,
  expandedId,
  setExpandedId,
  accent,
}: {
  title: string;
  total: number;
  categories: BalanceSheetCategory[];
  expandedId: BalanceSheetCategoryId | null;
  setExpandedId: (id: BalanceSheetCategoryId | null) => void;
  accent: "green" | "red";
}) {
  const headerClass = accent === "green" ? "border-emerald-100 bg-emerald-50/70" : "border-red-100 bg-red-50/70";
  return (
    <section className="space-y-3">
      <div className={`flex items-end justify-between gap-4 rounded-lg border p-4 ${headerClass}`}>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <div className="mt-1 text-sm text-slate-500">{categories.length} categories</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase text-slate-500">Total</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{money(total, total >= 1000000)}</div>
        </div>
      </div>
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          expanded={expandedId === category.id}
          onToggle={() => setExpandedId(expandedId === category.id ? null : category.id)}
          accent={accent}
        />
      ))}
    </section>
  );
}

export type ManualBalanceSheetAccount = {
  label: string;
  detail: string;
  value: number;
  type: string;
};

export default function FinancialBalanceSheet({
  sheet,
  manualAccounts = [],
}: {
  sheet: FinancialBalanceSheetData;
  manualAccounts?: ManualBalanceSheetAccount[];
}) {
  const [expandedId, setExpandedId] = useState<BalanceSheetCategoryId | null>("property");
  const displaySheet = useMemo(() => {
    if (manualAccounts.length === 0) return sheet;

    let assetsTotal = sheet.assetsTotal;
    let liabilitiesTotal = sheet.liabilitiesTotal;
    const manualSource: BalanceSheetSource = { label: "Manual Entry", updatedAt: new Date().toISOString() };
    const assets = sheet.assets.map((category) => {
      if (!["cash", "investments"].includes(category.id)) return category;
      const matching = manualAccounts.filter((account) =>
        category.id === "cash" ? account.type === "Cash" : account.type === "Investments"
      );
      if (matching.length === 0) return category;
      const extraValue = matching.reduce((total, account) => total + Math.abs(account.value), 0);
      assetsTotal += extraValue;
      return {
        ...category,
        value: category.value + extraValue,
        accountCount: category.accountCount + matching.length,
        accounts: [
          ...matching.map((account, index) => ({
            id: `manual-${category.id}-${index}-${account.label}`,
            name: account.label,
            value: Math.abs(account.value),
            source: manualSource,
            details: [
              { label: "Average Balance", value: money(Math.abs(account.value)) },
              { label: "Recent Transactions", value: "Manual account" },
              { label: "Monthly Change", value: "Not calculated yet" },
            ],
          })),
          ...category.accounts,
        ],
      };
    });

    const liabilities = sheet.liabilities.map((category) => {
      const matching = manualAccounts.filter((account) =>
        category.id === "credit-cards" ? account.type === "Credit Cards" : category.id === "personal-car-loans" ? account.type === "Loans" : false
      );
      if (matching.length === 0) return category;
      const extraValue = matching.reduce((total, account) => total + Math.abs(account.value), 0);
      liabilitiesTotal += extraValue;
      return {
        ...category,
        value: category.value + extraValue,
        accountCount: category.accountCount + matching.length,
        accounts: [
          ...matching.map((account, index) => ({
            id: `manual-${category.id}-${index}-${account.label}`,
            name: account.label,
            value: Math.abs(account.value),
            source: manualSource,
            details: [
              { label: "Balance", value: money(Math.abs(account.value)) },
              { label: "Interest Rate", value: "Manual entry" },
              { label: "Repayments", value: account.detail },
            ],
          })),
          ...category.accounts,
        ],
      };
    });

    return {
      ...sheet,
      assets,
      liabilities,
      assetsTotal,
      liabilitiesTotal,
      netWorth: assetsTotal - liabilitiesTotal,
    };
  }, [manualAccounts, sheet]);
  const allCategories = useMemo(() => [...displaySheet.assets, ...displaySheet.liabilities], [displaySheet.assets, displaySheet.liabilities]);
  const largestCategory = allCategories.slice().sort((a, b) => b.value - a.value)[0];

  return (
    <article id="financial-balance-sheet" className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
      <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur md:static md:mx-0 md:mt-0 md:border-b-0 md:bg-transparent md:p-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Financial Vault foundation
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">Financial Balance Sheet</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Your assets, liabilities and net worth at a glance.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span>Last updated {shortDate(displaySheet.asOf)}</span>
              <span>Source: Financial Vault + manual entries</span>
              <span>Trend: {displaySheet.monthlyNetChange >= 0 ? "+" : ""}{money(displaySheet.monthlyNetChange)} this month</span>
              <span>Status: Healthy</span>
            </div>
          </div>
          <div className="rounded-lg bg-blue-950 px-5 py-4 text-white">
            <div className="text-xs font-semibold uppercase text-slate-300">Net Worth</div>
            <div className="mt-1 text-3xl font-semibold">{money(displaySheet.netWorth, true)}</div>
            <div className="mt-1 text-sm text-slate-300">Assets - Liabilities</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Assets" value={money(displaySheet.assetsTotal, true)} note="Verified and manual balances" />
        <KpiCard label="Liabilities" value={money(displaySheet.liabilitiesTotal, true)} note="Mortgage, cards and loans" />
        <KpiCard label="Net Worth" value={money(displaySheet.netWorth, true)} note={`Largest category: ${largestCategory?.label ?? "n/a"}`} />
        <KpiCard label="Monthly Net Change" value={`${displaySheet.monthlyNetChange >= 0 ? "+" : ""}${money(displaySheet.monthlyNetChange)}`} note="Income, markets and debt movement" />
        <KpiCard label="Emergency Fund Months" value={`${displaySheet.emergencyFundMonths.toFixed(1)} mo`} note="Cash divided by core spending" />
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-4">
        <Link href="/housing-scenarios" className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 transition hover:border-emerald-200">
          <div className="text-xs font-semibold uppercase text-emerald-700">Borrowing Capacity</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{money(displaySheet.borrowingCapacity, true)}</div>
        </Link>
        <Link href="/housing-scenarios" className="rounded-lg border border-blue-100 bg-blue-50 p-4 transition hover:border-blue-200">
          <div className="text-xs font-semibold uppercase text-blue-700">Current Deposit</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{money(displaySheet.currentDeposit)}</div>
        </Link>
        <Link href="/housing-scenarios" className="rounded-lg border border-purple-100 bg-purple-50 p-4 transition hover:border-purple-200">
          <div className="text-xs font-semibold uppercase text-purple-700">Available Equity</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{money(displaySheet.availableEquity, true)}</div>
        </Link>
        <Link href="/housing-scenarios" className="rounded-lg border border-orange-100 bg-orange-50 p-4 transition hover:border-orange-200">
          <div className="text-xs font-semibold uppercase text-orange-700">House Readiness Score</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{displaySheet.houseReadinessScore}/100</div>
        </Link>
      </section>

      {displaySheet.refinance.monthlySaving > 0 && (
        <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">Refinance signal</div>
              <div className="mt-1 text-sm text-slate-600">Estimated refinance saving from current mortgage assumptions.</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <KpiCard label="Monthly" value={money(displaySheet.refinance.monthlySaving)} />
              <KpiCard label="Annual" value={money(displaySheet.refinance.annualSaving)} />
              <KpiCard label="Confidence" value={displaySheet.refinance.confidence} />
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <CategoryColumn title="Assets" total={displaySheet.assetsTotal} categories={displaySheet.assets} expandedId={expandedId} setExpandedId={setExpandedId} accent="green" />
        <CategoryColumn title="Liabilities" total={displaySheet.liabilitiesTotal} categories={displaySheet.liabilities} expandedId={expandedId} setExpandedId={setExpandedId} accent="red" />
      </div>

      <div className="mt-5 rounded-lg border border-blue-900 bg-blue-950 p-5 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-400">Net Worth</div>
            <div className="mt-1 text-3xl font-semibold">{money(displaySheet.netWorth)}</div>
          </div>
          <div className="text-sm leading-6 text-slate-300">
            {money(displaySheet.assetsTotal)} assets - {money(displaySheet.liabilitiesTotal)} liabilities
          </div>
        </div>
      </div>
    </article>
  );
}

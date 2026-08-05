import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import {
  getFinancialBalanceSheet,
  getFinancialBalanceSheetCategory,
  getFinancialBalanceSheetCategoryIds,
  type BalanceSheetCategory,
} from "@/lib/financialBalanceSheet";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getFinancialBalanceSheetCategoryIds().map((category) => ({ category }));
}

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function sourceLabel(category: BalanceSheetCategory) {
  return `${category.source.label} - ${new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(category.source.updatedAt))}`;
}

function pageSections(category: BalanceSheetCategory) {
  if (category.id === "cash") return ["Accounts", "Recent Transactions", "Average Balance"];
  if (category.id === "investments") return ["Performance", "Allocation", "Returns"];
  if (category.id === "property") return ["Portfolio", "Estimated Values", "Equity"];
  if (category.id === "mortgages" || category.id === "personal-car-loans" || category.id === "credit-cards") {
    return ["Balance", "Interest Rate", "Repayments", "Refinancing Opportunities"];
  }
  if (category.id === "superannuation") return ["Performance", "Insurance", "Fees", "Contributions"];
  return ["Accounts", "Balance", "Review Notes"];
}

export default async function BalanceSheetCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categoryId } = await params;
  const category = getFinancialBalanceSheetCategory(categoryId);
  const sheet = getFinancialBalanceSheet();

  if (!category) notFound();

  return (
    <AppShell active="dashboard">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/#financial-balance-sheet" className="text-sm font-semibold text-blue-600">
              Back to Financial Balance Sheet
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{category.label}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Drill-down view sourced from the Financial Profile Vault foundation. Values are local demo data until extraction is expanded.
            </p>
          </div>
          <div className="rounded-lg bg-[#10243b] px-5 py-4 text-white">
            <div className="text-xs font-semibold uppercase text-slate-300">Current Value</div>
            <div className="mt-1 text-3xl font-semibold">{money(category.value, category.value >= 1000000)}</div>
            <div className="mt-1 text-sm text-slate-300">Source: {sourceLabel(category)}</div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Status", category.status],
            [category.healthIndicator.label, category.healthIndicator.status],
            ["Accounts", `${category.accountCount}`],
            [category.primaryMetric.label, category.primaryMetric.value],
            ["Net Worth Context", `${Math.round((category.value / sheet.netWorth) * 100)}%`],
          ].map(([label, value], index) => (
            <article key={`${label}-${index}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
              <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-950">AI insight</div>
          <p className="mt-2 text-sm leading-6 text-blue-900">{category.aiInsight}</p>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <h2 className="text-lg font-semibold text-slate-950">{category.label} accounts</h2>
            <div className="mt-5 space-y-4">
              {category.accounts.length > 0 ? (
                category.accounts.map((account) => (
                  <div key={account.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-950">{account.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Source: {account.source.label}</div>
                      </div>
                      <div className="text-xl font-semibold text-slate-950">{money(account.value)}</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {account.details.map((detail) => (
                        <div key={`${account.id}-${detail.label}`} className="rounded-lg bg-white p-3">
                          <div className="text-[11px] font-semibold uppercase text-slate-500">{detail.label}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-950">{detail.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                  No active accounts recorded.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <h2 className="text-lg font-semibold text-slate-950">Category workspace</h2>
            <div className="mt-5 space-y-3">
              {pageSections(category).map((section) => (
                <div key={section} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">{section}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">
                    {section} data is ready for Financial Vault enrichment and AI Financial Coach analysis.
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}

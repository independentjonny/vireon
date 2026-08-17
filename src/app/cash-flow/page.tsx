import Link from "next/link";
import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import type { MonthlyCashFlowLine } from "@/lib/monthlyCashFlow";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function metric(value: number | null, signed = false) {
  if (value === null) return "Unavailable";
  return `${signed && value >= 0 ? "+" : ""}${money(value)}`;
}

function breakdown(lines: MonthlyCashFlowLine[], total: number | null, tone: "income" | "expense") {
  if (!lines.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">No confirmed recurring {tone} records with a usable monthly amount or cadence.</div>;
  }
  return lines.map((line) => {
    const share = total && total > 0 ? Math.round((line.monthlyAmount / total) * 100) : 0;
    return (
      <div key={line.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">{line.label}</div>
            <div className="mt-1 text-xs capitalize text-slate-500">{line.category.replaceAll("-", " ")} · {line.cadence} · {line.approximate ? "Estimated" : "Confirmed"} · Record {line.sourceRecordIds[0]}</div>
          </div>
          <div className="text-lg font-semibold text-slate-950">{money(line.monthlyAmount)}</div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white">
          <div className={`h-2 rounded-full ${tone === "income" ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, share)}%` }} />
        </div>
        <div className="mt-2 text-xs font-semibold text-slate-500">{share}% of monthly {tone}</div>
      </div>
    );
  });
}

export default async function CashFlowPage() {
  const session = await requireServerPageSession("/cash-flow");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);
  const cashFlow = position.monthlyCashFlow;
  const emergencyMonths = position.cashPosition.sourceRecordIds.length && cashFlow.monthlyExpenses && cashFlow.monthlyExpenses > 0
    ? position.cashPosition.confirmedCash / cashFlow.monthlyExpenses
    : null;
  const statusNote = cashFlow.status === "confirmed"
    ? "Confirmed recurring records"
    : cashFlow.status === "estimated"
      ? "Estimate from confirmed records"
      : "Confirmed monthly inputs are incomplete";

  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Cash Flow Workspace"
        title="Cash Flow"
        subtitle="Understand confirmed monthly income, expenses, surplus, and the records behind every displayed value."
        metrics={[
          { label: "Monthly Surplus", value: metric(cashFlow.monthlySurplus, true), note: statusNote },
          { label: "Income", value: metric(cashFlow.monthlyIncome), note: "Normalised confirmed monthly income" },
          { label: "Expenses", value: metric(cashFlow.monthlyExpenses), note: "Normalised confirmed monthly expenses" },
          { label: "Emergency Fund", value: emergencyMonths === null ? "Unavailable" : `${emergencyMonths.toFixed(1)} mo`, note: "Confirmed cash divided by monthly expenses" },
        ]}
        actions={[{ label: "Find Savings", href: "/insights" }]}
      >
        <section role="status" className={`rounded-lg border p-4 ${cashFlow.status === "confirmed" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : cashFlow.status === "estimated" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
          <div className="text-sm font-semibold">{cashFlow.status === "confirmed" ? "Confirmed monthly cash flow" : cashFlow.status === "estimated" ? "Estimated monthly cash flow" : "Monthly cash flow unavailable"}</div>
          <p className="mt-1 text-sm leading-6">{cashFlow.basis}</p>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold text-slate-950">Income breakdown</h2><p className="mt-1 text-sm text-slate-500">Recurring values normalised to a monthly basis.</p></div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-right"><div className="text-xs font-semibold uppercase text-emerald-700">Total income</div><div className="mt-1 text-xl font-semibold text-slate-950">{metric(cashFlow.monthlyIncome)}</div></div>
            </div>
            <div className="mt-6 space-y-4">{breakdown(cashFlow.incomeLines, cashFlow.monthlyIncome, "income")}</div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold text-slate-950">Expense breakdown</h2><p className="mt-1 text-sm text-slate-500">Recurring values normalised to a monthly basis.</p></div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-right"><div className="text-xs font-semibold uppercase text-blue-700">Total expenses</div><div className="mt-1 text-xl font-semibold text-slate-950">{metric(cashFlow.monthlyExpenses)}</div></div>
            </div>
            <div className="mt-6 space-y-4">{breakdown(cashFlow.expenseLines, cashFlow.monthlyExpenses, "expense")}</div>
          </article>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <h2 className="text-lg font-semibold text-slate-950">Calculation evidence</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">This total uses {cashFlow.sourceRecordIds.length} confirmed source record{cashFlow.sourceRecordIds.length === 1 ? "" : "s"}. Explicit recurring records take precedence over transaction averages to prevent double counting.</p>
            {cashFlow.warnings.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-amber-800">{cashFlow.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            <Link href="/financial-vault" className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700">Review source records</Link>
          </article>
          <article className="rounded-lg border border-blue-100 bg-blue-50 p-6">
            <div className="text-sm font-semibold text-blue-900">How monthly values are calculated</div>
            <p className="mt-4 text-sm leading-6 text-blue-900">Weekly values use 52 ÷ 12, fortnightly values use 26 ÷ 12, quarterly values use 4 ÷ 12, and annual values use 1 ÷ 12. One-off or cadence-free amounts are not silently treated as monthly.</p>
          </article>
        </section>
      </PremiumWorkspacePage>
    </AppShell>
  );
}

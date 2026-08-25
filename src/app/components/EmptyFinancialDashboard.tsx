import Link from "next/link";
import { ArrowRight, CircleDollarSign, FileCheck2, Home, WalletCards } from "lucide-react";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";
import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import IntegratedGoalsWidget from "./IntegratedGoalsWidget";
import FinancialHealthIndicatorsWidget from "./FinancialHealthIndicatorsWidget";

const emptyMetrics = [
  { label: "Net worth", icon: CircleDollarSign },
  { label: "Monthly cash flow", icon: WalletCards },
  { label: "Borrowing readiness", icon: Home },
  { label: "Financial documents", icon: FileCheck2 },
];

export default function EmptyFinancialDashboard({ goalsSnapshot, financialHealth }: { goalsSnapshot: GoalPlanningSnapshot; financialHealth: FinancialHealthSnapshot }) {
  return (
    <main className="mx-auto max-w-[1180px] space-y-4 pb-24">
      <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="text-sm font-semibold text-blue-700">Vireon overview</div>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Your financial position</h1>
        <p className="mt-1 text-sm text-slate-600">What you own, owe, earn and should do next.</p>
      </section>

      <section aria-label="Current position" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {emptyMetrics.map(({ label, icon: Icon }) => (
          <article key={label} className="min-h-[96px] rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-500">Not added</div>
              </div>
              <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-2 text-xs font-medium text-slate-500">No confirmed financial data</div>
          </article>
        ))}
      </section>

      <IntegratedGoalsWidget snapshot={goalsSnapshot} />

      <FinancialHealthIndicatorsWidget health={financialHealth} goals={goalsSnapshot} />

      <section className="rounded-lg border border-blue-100 bg-white p-6 sm:p-8">
        <div className="max-w-2xl">
          <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Financial data cleared</div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">Your Vireon account is ready for a fresh start.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your account and personal details are retained. Add only the financial records you want Vireon to use.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/financial-profile/add-data" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">
              Add financial data <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/financial-vault" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">Open Document Vault</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

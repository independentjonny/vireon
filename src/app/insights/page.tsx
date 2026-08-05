import AppShell from "../components/AppShell";
import AiDecisionCentre from "../components/AiDecisionCentre";
import DailyReviewCard from "../components/DailyReviewCard";
import { buildAiDecisions } from "@/lib/aiDecisionCentre";
import { buildFinancialBalanceSheetFromReadModel } from "@/lib/financialBalanceSheet";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const session = await requireServerPageSession("/insights");
  const readModel = await createFinancialPositionReadServiceFromEnv().read(session);
  const vault = readModel.vault;
  const core = createCoreDecisioningServiceFromEnv();
  const housing = await core.readHousingAffordability(session);
  const balanceSheet = buildFinancialBalanceSheetFromReadModel(readModel);
  const decisions = buildAiDecisions({ vault, housing, balanceSheet });
  const dailyReview = await core.getLatestDailyReview(session);
  const decisionCentre = await core.readDecisionCentre(session);
  const criticalOrHigh = decisions.filter((decision) => decision.priority === "Critical" || decision.priority === "High").length;
  const highConfidence = decisions.filter((decision) => decision.confidence === "High").length;

  return (
    <AppShell active="workspace">
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              AI Decision Centre v1
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Insights</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ranked financial decisions with deterministic rules first. Review, action, and dismissal state is persisted to PostgreSQL so recommendations survive restart without a local fallback.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Total Decisions", decisions.length.toString(), "Across Vault, Balance Sheet, Housing, Cash Flow, Subscriptions, Goals and Alerts"],
            ["Critical / High", criticalOrHigh.toString(), "Highest priority recommendations"],
            ["High Confidence", highConfidence.toString(), "Rules with stronger source support"],
          ].map(([label, value, note]) => (
            <article key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
              <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{note}</div>
            </article>
          ))}
        </section>

        <DailyReviewCard record={dailyReview} compact />

        <AiDecisionCentre decisions={decisions} initialDecisionState={decisionCentre.states} title="All ranked decisions" />
      </div>
    </AppShell>
  );
}

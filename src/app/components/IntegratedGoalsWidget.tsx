import Link from "next/link";
import { ArrowRight, Link2, Target } from "lucide-react";
import { DEFAULT_RETIREMENT_GOAL_ID, type GoalPlanningSnapshot } from "@/lib/goalPlanning";

function statusLabel(feasibility: string): string {
  if (feasibility === "ACHIEVABLE") return "On track";
  if (feasibility === "STRETCHED") return "Needs attention";
  if (feasibility === "UNLIKELY") return "At risk";
  return "Needs setup";
}

export default function IntegratedGoalsWidget({ snapshot }: { snapshot: GoalPlanningSnapshot }) {
  const goals = snapshot.activeGoals;
  const retirement = goals.find((item) => item.goal.id === DEFAULT_RETIREMENT_GOAL_ID) ?? goals.find((item) => item.goal.type === "RETIREMENT") ?? goals[0];
  const onTrack = goals.filter((item) => ["ACHIEVABLE", "ACHIEVED"].includes(item.feasibility) || item.goal.status === "ACHIEVED").length;
  const attention = goals.filter((item) => ["STRETCHED", "UNLIKELY"].includes(item.feasibility)).length;
  const interaction = snapshot.aiCfoContext.conflicts[0]
    ?? (goals.length > 1 ? "No material conflict is currently detected between your goals." : "Add another goal to see how it changes your retirement path and overall position.");

  return (
    <section data-testid="dashboard-integrated-goals" className="rounded-lg border border-blue-100 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-950">Integrated Goals</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Every goal shares the same income, cash flow, assets and liabilities, so changing one can affect the others.</p>
        </div>
        <Link href="/goals" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-700">
          View Integrated Goals <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-950">{retirement?.goal.title ?? "Retire at 60"}</h3>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Default goal</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Your long-term baseline for every other financial decision.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{retirement ? statusLabel(retirement.feasibility) : "Needs setup"}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700">Next step: confirm your retirement balance, desired lifestyle and date of birth to calculate the path.</p>
        </article>

        <article className="rounded-lg border border-slate-200 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-xl font-semibold text-slate-950">{goals.length}</div><div className="text-xs text-slate-500">Active</div></div>
            <div><div className="text-xl font-semibold text-emerald-700">{onTrack}</div><div className="text-xs text-slate-500">On track</div></div>
            <div><div className="text-xl font-semibold text-amber-700">{attention}</div><div className="text-xs text-slate-500">Attention</div></div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800"><Link2 className="h-4 w-4" aria-hidden="true" /> Goal interaction</span>
            <p className="mt-1">{interaction}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

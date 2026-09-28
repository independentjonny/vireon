"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  FinancialGoal,
  GoalPlanningSnapshot,
  GoalPriority,
  GoalScenarioVariant,
  GoalType,
} from "@/lib/goalPlanning";
import {
  wealthTrajectory,
  type TrajectorySettings,
} from "@/lib/wealthTrajectory";
import TrajectorySettingsClient from "./TrajectorySettingsClient";
import "./goals.css";
import { hasGoalEstimate } from "@/lib/goalPresentation";
const types: Array<[GoalType, string]> = [
  ["RETIREMENT", "Retirement"],
  ["EMERGENCY_FUND", "Emergency fund"],
  ["HOME_PURCHASE", "Home purchase"],
  ["DEBT_REPAYMENT", "Debt repayment"],
  ["SAVINGS", "Savings"],
  ["VEHICLE_PURCHASE", "Vehicle"],
  ["EDUCATION", "Education"],
  ["TRAVEL", "Travel"],
  ["INVESTMENT", "Investment"],
  ["INCOME", "Income"],
  ["CUSTOM", "Custom goal"],
];
const money = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
const words = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
const date = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(s.slice(0, 10) + "T00:00:00"))
    : "Not set";
type ResponseData = {
  error?: string;
  snapshot?: GoalPlanningSnapshot;
  goals?: FinancialGoal[];
  scenarios?: GoalScenarioVariant[];
};
export default function GoalsPlanningClient({
  initialSnapshot,
  initialGoals,
  initialScenarios,
  initialTrajectory,
  netWorth,
  openRetirement = false,
}: {
  initialSnapshot: GoalPlanningSnapshot;
  initialGoals: FinancialGoal[];
  initialScenarios: GoalScenarioVariant[];
  initialTrajectory: TrajectorySettings | null;
  netWorth: number | null;
  openRetirement?: boolean;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot),
    [goals, setGoals] = useState(initialGoals),
    [scenarios, setScenarios] = useState(initialScenarios);
  const [trajectory, setTrajectory] = useState(initialTrajectory),
    [retirementOpen, setRetirementOpen] = useState(openRetirement),
    [adding, setAdding] = useState(false);
  const [type, setType] = useState<GoalType | null>(null),
    [title, setTitle] = useState(""),
    [target, setTarget] = useState(""),
    [current, setCurrent] = useState(""),
    [targetDate, setTargetDate] = useState(""),
    [contribution, setContribution] = useState(""),
    [priority, setPriority] = useState<GoalPriority>("medium");
  const [scenarioAmounts, setScenarioAmounts] = useState<
      Record<string, string>
    >({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const retirementGoals = snapshot.activeGoals.filter(
    (e) => e.goal.type === "RETIREMENT" && e.goal.status !== "PAUSED",
  );
  const otherGoals = snapshot.activeGoals.filter(
    (e) => e.goal.type !== "RETIREMENT" && e.goal.status !== "PAUSED",
  );
  const historical = goals.filter(
    (g) => g.status === "ARCHIVED" || g.status === "PAUSED",
  );
  let outcome: ReturnType<typeof wealthTrajectory>[number] | undefined;
  if (trajectory && netWorth !== null) {
    try {
      outcome = wealthTrajectory(netWorth, trajectory).at(-1);
    } catch {
      /* The setup remains available when the starting position cannot be projected. */
    }
  }
  async function mutate(payload: unknown, success: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as ResponseData;
      if (!r.ok || !d.snapshot || !d.goals || !d.scenarios)
        throw Error(d.error ?? "Could not save your goal. Try again.");
      setSnapshot(d.snapshot);
      setGoals(d.goals);
      setScenarios(d.scenarios);
      setMessage(success);
      router.refresh();
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function choose(next: GoalType) {
    if (next === "RETIREMENT") {
      setRetirementOpen(true);
      setAdding(false);
      requestAnimationFrame(() =>
        document
          .getElementById("retirement")
          ?.scrollIntoView({ behavior: "smooth" }),
      );
      return;
    }
    setAdding(true);
    setRetirementOpen(false);
    requestAnimationFrame(() =>
      document
        .getElementById("add-goal")
        ?.scrollIntoView({ behavior: "smooth" }),
    );
    setType(next);
    setTitle(types.find((t) => t[0] === next)?.[1] ?? "");
    setTarget("");
    setCurrent("");
    setTargetDate("");
    setContribution("");
  }
  async function create() {
    if (!type) return;
    const ok = await mutate(
      {
        action: "create-goal",
        goal: {
          type,
          title: title.trim(),
          targetAmount: Number(target),
          currentAmount: Number(current),
          targetDate,
          contributionAmount: Number(contribution),
          priority,
        },
      },
      "Goal added.",
    );
    if (ok) {
      setAdding(false);
      setType(null);
    }
  }
  function controls(goal: FinancialGoal) {
    return (
      <details>
        <summary>Manage goal</summary>
        <div className="goals-actions">
          {goal.status !== "PAUSED" && (
            <button
              disabled={busy}
              onClick={() =>
                void mutate(
                  { action: "pause-goal", goalId: goal.id },
                  "Goal paused. It remains in Paused and archived goals below.",
                )
              }
            >
              Pause goal
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              void mutate(
                { action: "archive-goal", goalId: goal.id },
                "Goal archived. Its saved details remain available below.",
              )
            }
          >
            Archive goal
          </button>
        </div>
      </details>
    );
  }
  function comparisons(goalId: string, canCalculate: boolean) {
    return (
      <details>
        <summary>Explore changes</summary>
        <p>
          Compare a different monthly contribution. This saves a scenario
          without changing your goal or financial records.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(
              {
                action: "save-scenario",
                scenario: {
                  goalId,
                  name: "custom",
                  contributionAmount: Number(scenarioAmounts[goalId]),
                },
              },
              "Comparison saved.",
            );
          }}
        >
          <label className="goals-field">
            Monthly contribution to compare (AUD)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={scenarioAmounts[goalId] ?? ""}
              onChange={(e) =>
                setScenarioAmounts({
                  ...scenarioAmounts,
                  [goalId]: e.target.value,
                })
              }
            />
          </label>
          <div className="goals-actions">
            <button disabled={busy || !canCalculate}>
              Compare contribution
            </button>
          </div>
        </form>
        {!canCalculate && (
          <p>
            Add the missing goal or financial information before comparing
            outcomes.
          </p>
        )}
        {snapshot.aiCfoContext.scenarioComparisons
          .filter((c) => c.goalId === goalId)
          .map((c) => (
            <div className="goals-comparison" key={c.comparedScenarioId}>
              {canCalculate ? (
                <>
                  <strong>
                    {money(
                      scenarios.find((s) => s.id === c.comparedScenarioId)
                        ?.contributionAmount ?? 0,
                    )}{" "}
                    per month
                  </strong>
                  <p>
                    Completion change:{" "}
                    {c.projectedCompletionDeltaMonths === null
                      ? "Not comparable"
                      : `${c.projectedCompletionDeltaMonths} months`}
                    . Monthly cash-flow change: {money(c.cashFlowDelta)}.
                  </p>
                </>
              ) : (
                <p>Saved comparison · results not calculated yet.</p>
              )}
            </div>
          ))}
      </details>
    );
  }
  return (
    <main className="goals-page">
      <header className="goals-heading">
        <div>
          <h1>Your goals</h1>
          <p>Choose what you want to achieve. All your goals belong here.</p>
        </div>
      </header>
      <section aria-labelledby="goal-options-title">
        <h2 id="goal-options-title">What would you like to plan?</h2>
        <p>Choose a goal to get started. Your saved goals are shown below.</p>
        <div className="goals-catalogue">
          {types.map(([value, label]) => {
            const count = snapshot.activeGoals.filter(
              (e) => e.goal.type === value && e.goal.status !== "PAUSED",
            ).length;
            return (
              <button
                key={value}
                aria-expanded={
                  value === "RETIREMENT"
                    ? retirementOpen
                    : adding && type === value
                }
                aria-controls={
                  value === "RETIREMENT" ? "retirement" : "add-goal"
                }
                onClick={() => choose(value)}
              >
                <strong>{label}</strong>
                <span>
                  {count
                    ? `${count} saved ${count === 1 ? "goal" : "goals"}`
                    : value === "RETIREMENT" && trajectory
                      ? "Plan saved"
                      : "Start planning"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div role="status" className={message ? "goals-notice" : ""}>
        {message}
      </div>
      {retirementOpen && (
        <section
          className="goals-card"
          id="retirement"
          aria-labelledby="retirement-title"
        >
          <div className="goals-card-heading">
            <div>
              <h2 id="retirement-title">Retirement</h2>
              <p>Your retirement age and wealth projection</p>
            </div>
            <span className="goals-badge">
              {outcome ? "Illustrative projection" : "Needs setup"}
            </span>
          </div>
          <dl className="goals-metrics">
            <div>
              <dt>Retirement age</dt>
              <dd>{trajectory?.retirementAge ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Projected net wealth · base</dt>
              <dd>{outcome ? money(outcome.base) : "Not calculated yet"}</dd>
            </div>
            <div>
              <dt>In today’s money</dt>
              <dd>
                {outcome ? money(outcome.realBase) : "Not calculated yet"}
              </dd>
            </div>
          </dl>
          {outcome ? (
            <p>
              Lower {money(outcome.low)} · Higher {money(outcome.high)}. These
              are illustrations using your assumptions, not a measure of
              retirement readiness.
            </p>
          ) : (
            <p>
              {trajectory
                ? "Review your confirmed assets and debts to establish a usable starting net position."
                : "Set your current age, retirement age and assumptions to see a projection. Your other goals stay on this page."}
            </p>
          )}
          <button
            className="goals-primary"
            aria-expanded={retirementOpen}
            aria-controls="retirement-editor"
            onClick={() => setRetirementOpen(!retirementOpen)}
          >
            {retirementOpen
              ? "Close retirement settings"
              : trajectory
                ? "Edit retirement plan"
                : "Set up retirement"}
          </button>
          <div id="retirement-editor">
            {retirementOpen && (
              <TrajectorySettingsClient
                initialSettings={trajectory}
                onSaved={(s) => {
                  setTrajectory(s);
                  router.refresh();
                }}
              />
            )}
          </div>
          {retirementGoals.length > 0 && (
            <details>
              <summary>
                Saved retirement targets ({retirementGoals.length})
              </summary>
              <p>
                Your saved targets are preserved below. The retirement age above
                controls the Dashboard projection; target names do not set that
                age.
              </p>
              {retirementGoals.map(({ goal }) => (
                <div className="goals-comparison" key={goal.id}>
                  <strong>{goal.title}</strong>
                  <p>
                    Target:{" "}
                    {goal.targetAmount > 0
                      ? money(goal.targetAmount)
                      : "Not set"}{" "}
                    · Target date: {date(goal.targetDate)} ·{" "}
                    {words(goal.status)}
                  </p>
                  {controls(goal)}
                </div>
              ))}
            </details>
          )}
        </section>
      )}
      <section aria-labelledby="other-goals-title">
        <h2 id="other-goals-title">Your saved goals</h2>
        <p>
          {otherGoals.length + retirementGoals.length > 0 || trajectory
            ? "Review your progress or choose a goal above to make a new plan."
            : "No goals saved yet. Choose any goal above to begin."}
        </p>
        <div className="goals-grid">
          {(retirementGoals.length > 0 || trajectory) && (
            <article className="goals-card">
              <div className="goals-card-heading">
                <h3>Retirement</h3>
                <span className="goals-badge">
                  {trajectory
                    ? `Age ${trajectory.retirementAge}`
                    : "Age not set"}
                </span>
              </div>
              {retirementGoals.map(({ goal }) => (
                <p key={goal.id}>
                  {goal.title} ·{" "}
                  {goal.targetAmount > 0
                    ? money(goal.targetAmount)
                    : "Target amount not set"}
                </p>
              ))}
              <p>
                {outcome
                  ? `${money(outcome.base)} projected net wealth · base illustration`
                  : "Set your retirement age and assumptions to calculate a projection."}
              </p>
              <button onClick={() => choose("RETIREMENT")}>
                Open retirement plan
              </button>
            </article>
          )}
          {otherGoals.map((e) => {
            const g = e.goal,
              ready = hasGoalEstimate(e);
            return (
              <article className="goals-card" key={g.id}>
                <div className="goals-card-heading">
                  <h3>{g.title}</h3>
                  <span className="goals-badge">
                    {ready ? words(e.feasibility) : "Needs information"}
                  </span>
                </div>
                <p>
                  {types.find((t) => t[0] === g.type)?.[1] ?? words(g.type)} ·{" "}
                  {words(g.priority)} priority
                </p>
                <dl className="goals-metrics">
                  <div>
                    <dt>Target</dt>
                    <dd>
                      {g.targetAmount > 0 ? money(g.targetAmount) : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt>Saved so far</dt>
                    <dd>{money(g.currentAmount)}</dd>
                  </div>
                  <div>
                    <dt>Target date</dt>
                    <dd>{date(g.targetDate)}</dd>
                  </div>
                </dl>
                {g.targetAmount > 0 && (
                  <>
                    <progress
                      aria-label={`${g.title} funding progress`}
                      max="100"
                      value={Math.max(0, Math.min(100, e.currentProgress))}
                    />
                    <small>
                      {Math.round(e.currentProgress)}% of target funded
                    </small>
                  </>
                )}
                <p>
                  {ready
                    ? `${money(e.requiredMonthlyContribution)} per month needed · ${money(e.fundingGap)} funding gap.`
                    : "Not calculated yet. Check the target amount, target date and confirmed income, spending and balances."}
                </p>
                {!ready && (
                  <Link href="/financial-profile/add-data">
                    Review financial information
                  </Link>
                )}
                <details>
                  <summary>Goal details & milestones</summary>
                  <p>
                    Planned contribution: {money(g.contributionAmount)} (
                    {g.contributionFrequency}). {g.description}
                  </p>
                  {ready && (
                    <p>
                      Projected completion:{" "}
                      {e.projectedCompletionDate
                        ? date(e.projectedCompletionDate)
                        : "Not calculated yet"}
                      .
                    </p>
                  )}
                  {ready && e.homePurchase && (
                    <p>
                      Indicative loan{" "}
                      {money(e.homePurchase.indicativeLoanAmount)}; repayment{" "}
                      {money(e.homePurchase.indicativeMonthlyRepayment)} per
                      month. Not borrowing approval.
                    </p>
                  )}
                  {ready &&
                    e.milestones.map((m) => (
                      <p key={m.id}>
                        {m.title} · {date(m.date)} · {money(m.amount)}
                      </p>
                    ))}
                  {e.decisions.map((d) => (
                    <p key={d.id}>{d.nextAction}</p>
                  ))}
                </details>
                {comparisons(g.id, ready)}
                {controls(g)}
              </article>
            );
          })}
        </div>
      </section>
      {adding && (
        <section className="goals-card" id="add-goal">
          <h2>Add a goal</h2>
          <p>
            Enter your own amounts and dates. Choose a different goal above at
            any time.
          </p>
          <button onClick={() => setAdding(false)}>Cancel new goal</button>
          {type && (
            <form
              className="goals-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <h3>{types.find((t) => t[0] === type)?.[1]}</h3>
              <div className="goals-fields">
                <label className="goals-field">
                  Goal name
                  <input
                    required
                    maxLength={150}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="goals-field">
                  Target date
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </label>
                <label className="goals-field">
                  Target amount (AUD)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </label>
                <label className="goals-field">
                  Amount already funded (AUD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </label>
                <label className="goals-field">
                  Planned monthly contribution (AUD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={contribution}
                    onChange={(e) => setContribution(e.target.value)}
                  />
                </label>
                <label className="goals-field">
                  Priority
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as GoalPriority)
                    }
                  >
                    {["low", "medium", "high", "critical"].map((p) => (
                      <option key={p} value={p}>
                        {words(p)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p>
                Enter 0 for funding or contributions if none are planned yet.
              </p>
              <button disabled={busy} className="goals-primary">
                {busy ? "Saving…" : "Save goal"}
              </button>
            </form>
          )}
        </section>
      )}
      {historical.length > 0 && (
        <details className="goals-card">
          <summary>Paused and archived goals ({historical.length})</summary>
          <ul className="goals-saved-list">
            {historical.map((g) => (
              <li key={g.id}>
                <strong>{g.title}</strong> · {words(g.status)} · Target{" "}
                {g.targetAmount > 0 ? money(g.targetAmount) : "not set"} ·{" "}
                {date(g.targetDate)}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="goals-card">
        <summary>How projections work</summary>
        <p>
          Retirement uses your saved ages and explicit growth assumptions. Other
          goal estimates use your saved targets, contributions and the
          confirmed-record forecast. Calculations are illustrations, not
          guarantees.
        </p>
        <p>
          Missing information prevents an outcome from being calculated. Saved
          amounts remain visible even when an estimate is unavailable.
        </p>
      </details>
    </main>
  );
}

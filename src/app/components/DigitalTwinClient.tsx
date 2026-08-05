"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowRightLeft, BrainCircuit, CalendarClock, CircleDollarSign, GitCompare, HeartPulse, Landmark, Plus, ShieldCheck, Target, WalletCards } from "lucide-react";
import {
  FinancialDigitalTwinEngine,
  type SimulationEventType,
  type TwinPersistedState,
  type TwinScenario,
  type TwinSimulationEvent,
  type TwinSimulationOutput,
} from "@/lib/financialDigitalTwin";

const eventTypes: SimulationEventType[] = [
  "interest_rate_change",
  "inflation_change",
  "property_growth_change",
  "share_growth_change",
  "salary_increase",
  "promotion",
  "redundancy",
  "career_break",
  "children",
  "marriage",
  "divorce",
  "inheritance",
  "business_purchase",
  "investment_property_purchase",
  "etf_purchase",
  "retirement",
  "death",
  "aged_pension_eligibility",
  "super_drawdown",
  "tax_law_change",
];

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

function eventLabel(type: string): string {
  return type.replaceAll("_", " ");
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "risk" | "good" }) {
  const toneClass = tone === "risk" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function ScenarioOutput({ output }: { output: TwinSimulationOutput }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Net worth" value={money(output.netWorth)} tone="good" />
      <Metric label="Cash flow" value={money(output.cashFlow)} tone={output.cashFlow >= 0 ? "good" : "risk"} />
      <Metric label="Borrowing" value={money(output.borrowingCapacity)} />
      <Metric label="Tax paid" value={money(output.taxPaid)} />
      <Metric label="Risk score" value={`${output.riskScore}/100`} tone={output.riskScore > 65 ? "risk" : "default"} />
      <Metric label="Passive income" value={money(output.passiveIncome)} />
      <Metric label="Debt" value={money(output.debt)} tone={output.debt > 900000 ? "risk" : "default"} />
      <Metric label="Emergency fund" value={pct(output.emergencyFund)} />
      <Metric label="House readiness" value={`${output.houseReadiness}/100`} />
      <Metric label="Retirement score" value={`${output.retirementScore}/100`} />
    </section>
  );
}

export default function DigitalTwinClient({ initialState }: { initialState: TwinPersistedState }) {
  const [scenarios, setScenarios] = useState<TwinScenario[]>(initialState.scenarios);
  const [message, setMessage] = useState("Scenarios and simulation history are persisted in PostgreSQL.");
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialState.scenarios[0]?.id ?? "current");
  const [compareIds, setCompareIds] = useState<string[]>(initialState.scenarios.slice(0, 4).map((scenario) => scenario.id));
  const twin = initialState.twin;
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0];
  const output = useMemo(() => FinancialDigitalTwinEngine.simulate(twin, selectedScenario), [twin, selectedScenario]);
  const comparisons = useMemo(() => FinancialDigitalTwinEngine.compare(twin, scenarios.filter((scenario) => compareIds.includes(scenario.id)), 4), [twin, scenarios, compareIds]);
  const allTimelineEvents = [...twin.timeline.pastEvents, ...output.futureTimelineEvents].sort((a, b) => a.year - b.year);

  async function persistScenario(scenario: TwinScenario, run = false) {
    try {
      const saveResponse = await fetch("/api/digital-twin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save-scenario", scenario }),
      });
      const saveData = await saveResponse.json() as { ok?: boolean; state?: TwinPersistedState; error?: string };
      if (!saveResponse.ok || !saveData.state) throw new Error(saveData.error ?? "Scenario save failed");
      if (run) {
        const runResponse = await fetch("/api/digital-twin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "run-scenario", scenarioId: scenario.id }),
        });
        const runData = await runResponse.json() as { ok?: boolean; state?: TwinPersistedState; error?: string };
        if (!runResponse.ok || !runData.state) throw new Error(runData.error ?? "Simulation save failed");
        setScenarios(runData.state.scenarios);
      } else {
        setScenarios(saveData.state.scenarios);
      }
      setMessage("Saved to PostgreSQL.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Digital Twin persistence failed.");
    }
  }

  function updateScenarioEvent(eventId: string, year: number) {
    const nextScenario = { ...selectedScenario, events: selectedScenario.events.map((event) => event.id === eventId ? { ...event, year } : event) };
    setScenarios((current) => current.map((scenario) => scenario.id === selectedScenario.id ? nextScenario : scenario));
    void persistScenario(nextScenario, true);
  }

  function addScenario() {
    const id = `scenario-${Date.now()}`;
    const next: TwinScenario = {
      id,
      name: `Scenario ${scenarios.length + 1}`,
      twinId: twin.id,
      createdAt: new Date().toISOString(),
      horizonYears: 30,
      probability: 0.55,
      events: [
        {
          id: `${id}-event`,
          type: "salary_increase",
          label: "Salary increase",
          year: new Date(twin.calculatedAt).getFullYear() + 2,
          amount: 10000,
          probability: 0.6,
          confidence: "Medium",
          assumptions: ["New scenario created by user override"],
        },
      ],
    };
    setScenarios((current) => [next, ...current]);
    setSelectedScenarioId(id);
    setCompareIds((current) => [id, ...current].slice(0, 4));
    void persistScenario(next, true);
  }

  function addEvent(type: SimulationEventType) {
    const event: TwinSimulationEvent = {
      id: `${selectedScenario.id}-${type}-${Date.now()}`,
      type,
      label: eventLabel(type),
      year: new Date(twin.calculatedAt).getFullYear() + 3,
      amount: type.includes("purchase") ? 100000 : type.includes("change") ? undefined : 15000,
      rateDelta: type.includes("change") ? 1 : undefined,
      probability: 0.55,
      confidence: type.includes("law") || type === "death" ? "Low" : "Medium",
      assumptions: [`${eventLabel(type)} manually added to scenario`],
    };
    const nextScenario = { ...selectedScenario, events: [...selectedScenario.events, event] };
    setScenarios((current) => current.map((scenario) => scenario.id === selectedScenario.id ? nextScenario : scenario));
    void persistScenario(nextScenario, true);
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <BrainCircuit className="h-3.5 w-3.5" />
            Financial Digital Twin
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Digital Twin</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Simulate the user&apos;s complete financial life from Vault-backed facts. GPT can explain these outputs, but deterministic engines own every calculation.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Current age" value={`${twin.identity.currentAge}`} />
            <Metric label="Retirement age" value={`${twin.identity.retirementAge}`} />
            <Metric label="State" value={twin.identity.state} />
            <Metric label="Employment" value={eventLabel(twin.identity.employment)} />
          </div>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">{message}</div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Knowledge Health
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Twin confidence" value={pct(twin.knowledgeHealth.digitalTwinConfidence)} />
            <Metric label="Document coverage" value={pct(twin.knowledgeHealth.documentCoverage)} />
            <Metric label="Assumptions" value={`${twin.knowledgeHealth.assumptionCount}`} />
            <Metric label="Rule freshness" value={twin.knowledgeHealth.ruleFreshness} />
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Last calculation {new Date(twin.knowledgeHealth.lastCalculation).toLocaleString()}.
            Last verification {twin.knowledgeHealth.lastVerification}.
            {twin.knowledgeHealth.missingInputs.length > 0 && ` Missing: ${twin.knowledgeHealth.missingInputs.join(", ")}.`}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Scenario Manager</h2>
            <button type="button" onClick={addScenario} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10243b] px-3 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setSelectedScenarioId(scenario.id)}
                className={`w-full rounded-lg border p-3 text-left ${scenario.id === selectedScenario.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{scenario.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{scenario.events.length} events - {scenario.horizonYears} years - probability {pct(scenario.probability * 100)}</div>
                  </div>
                  <input type="checkbox" checked={compareIds.includes(scenario.id)} onChange={() => toggleCompare(scenario.id)} onClick={(event) => event.stopPropagation()} aria-label={`Compare ${scenario.name}`} />
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{selectedScenario.name}</h2>
              <p className="mt-1 text-sm text-slate-600">Drag future events to recalculate net worth, tax, borrowing, retirement and cash flow immediately.</p>
            </div>
            <select onChange={(event) => addEvent(event.target.value as SimulationEventType)} value="" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950">
              <option value="" disabled>Add event</option>
              {eventTypes.map((type) => <option key={type} value={type}>{eventLabel(type)}</option>)}
            </select>
          </div>
          <div className="mt-4 space-y-3">
            {selectedScenario.events.length === 0 && <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Current baseline has no future event overrides.</div>}
            {selectedScenario.events.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{event.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{eventLabel(event.type)} - {event.confidence} confidence</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-950">{event.year}</div>
                </div>
                <input
                  type="range"
                  min={new Date(twin.calculatedAt).getFullYear()}
                  max={new Date(twin.calculatedAt).getFullYear() + selectedScenario.horizonYears}
                  value={event.year}
                  onChange={(change) => updateScenarioEvent(event.id, Number(change.target.value))}
                  className="mt-3 w-full accent-blue-600"
                  aria-label={`${event.label} year`}
                />
              </div>
            ))}
          </div>
        </article>
      </section>

      <ScenarioOutput output={output} />

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Scenario Comparison</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Scenario</th>
                  <th className="px-4 py-3">Net Worth</th>
                  <th className="px-4 py-3">Borrowing</th>
                  <th className="px-4 py-3">Tax</th>
                  <th className="px-4 py-3">Cash Flow</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Probability</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">FI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisons.map((item) => (
                  <tr key={item.scenarioId}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{item.scenarioName}</td>
                    <td className="px-4 py-3">{money(item.netWorth)}</td>
                    <td className="px-4 py-3">{money(item.borrowing)}</td>
                    <td className="px-4 py-3">{money(item.tax)}</td>
                    <td className="px-4 py-3">{money(item.cashFlow)}</td>
                    <td className="px-4 py-3">{item.risk}/100</td>
                    <td className="px-4 py-3">{pct(item.probability * 100)}</td>
                    <td className="px-4 py-3">{item.confidence}</td>
                    <td className="px-4 py-3">{item.timeToFinancialIndependenceYears ?? "Not reached"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Decision Centre</h2>
          </div>
          <div className="mt-4 space-y-3">
            {output.decisions.map((decision) => (
              <div key={decision.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">{decision.title}</div>
                <div className="mt-2 text-xs font-semibold uppercase text-slate-500">{decision.financialImpact} - Confidence {decision.confidence}</div>
                <div className="mt-2 text-xs leading-5 text-slate-600">{decision.evidence.join(" ")}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Interactive Timeline</h2>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {allTimelineEvents.map((event) => (
              <div key={event.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-lg font-semibold text-slate-950">{event.year}</div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">{event.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">{event.description}</div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Financial Life Model</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              [WalletCards, "Cash", money(twin.assets.cash)],
              [Landmark, "Property", money(twin.assets.property)],
              [ArrowRightLeft, "Investments", money(twin.assets.investments)],
              [Target, "Super", money(twin.assets.super)],
              [CircleDollarSign, "Income", money(twin.cashFlow.income)],
              [HeartPulse, "Savings rate", pct(twin.cashFlow.savingsRate)],
            ].map(([Icon, label, value]) => {
              const TypedIcon = Icon as typeof WalletCards;
              return (
                <div key={label as string} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <TypedIcon className="h-5 w-5 text-blue-600" />
                  <div className="mt-3 text-xs font-semibold uppercase text-slate-500">{label as string}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{value as string}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            AI CFO integration: GPT receives simulation outputs, decisions, evidence and confidence only. It may explain, summarise, rank trade-offs and create action plans, but cannot perform or override calculations.
          </div>
        </article>
      </section>
    </div>
  );
}

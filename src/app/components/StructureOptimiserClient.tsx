"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Building2,
  CheckCircle2,
  FileText,
  Landmark,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  INVESTMENT_TYPE_LABELS,
  OWNERSHIP_STRUCTURES,
  STRUCTURE_LABELS,
  StructureComparisonEngine,
  type AustralianJurisdiction,
  type InvestmentType,
  type StructureAssumptionSet,
  type StructureOutcome,
} from "@/lib/structureComparisonEngine";

const tabs = ["Overview", "Annual Cash Flow", "Sale and CGT", "Borrowing", "Asset Protection", "Estate Planning", "Assumptions", "Evidence"] as const;
type Tab = (typeof tabs)[number];

const states: AustralianJurisdiction[] = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const investmentTypes = Object.keys(INVESTMENT_TYPE_LABELS) as InvestmentType[];

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function pct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function classificationLabel(value: string): string {
  return value.replaceAll("-", " ");
}

function numberInput(label: string, value: number, onChange: (value: number) => void, suffix = "") {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <div className="mt-1 flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-950 outline-none"
        />
        {suffix && <span className="text-xs font-semibold text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function StructureCard({ outcome }: { outcome: StructureOutcome }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{outcome.label}</h3>
          <div className="mt-1 text-xs font-semibold text-slate-500">Confidence: {outcome.confidenceLevel}</div>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {money(outcome.estimatedAfterTaxAnnualCashFlow)}/yr
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Indicative annual tax</span>
          <span className="font-semibold text-slate-950">{money(outcome.estimatedAnnualTax)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Sale proceeds after indicative tax</span>
          <span className="font-semibold text-slate-950">{money(outcome.estimatedSaleProceedsAfterIndicativeTax)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Setup / annual compliance</span>
          <span className="font-semibold text-slate-950">{money(outcome.setupCost)} / {money(outcome.annualComplianceCost)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Borrowing complexity</span>
          <span className="font-semibold text-slate-950">{outcome.borrowingComplexity}</span>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>Asset protection</span><span>{Math.round(outcome.assetProtectionScore)}</span></div>
          <ScoreBar value={outcome.assetProtectionScore} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>Flexibility</span><span>{Math.round(outcome.flexibilityScore)}</span></div>
          <ScoreBar value={outcome.flexibilityScore} />
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        {outcome.keyRisks[0]?.detail ?? outcome.keyLimitations[0] ?? "Professional review required before implementation."}
      </div>
    </article>
  );
}

function OutcomeTable({ outcomes, mode }: { outcomes: StructureOutcome[]; mode: "cash" | "sale" | "borrowing" | "protection" | "estate" }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Structure</th>
              {mode === "cash" && <><th className="px-4 py-3">Taxable income</th><th className="px-4 py-3">Tax</th><th className="px-4 py-3">After-tax cash flow</th><th className="px-4 py-3">10-year cash flow</th></>}
              {mode === "sale" && <><th className="px-4 py-3">CGT treatment</th><th className="px-4 py-3">Sale result</th><th className="px-4 py-3">Lifetime cost</th></>}
              {mode === "borrowing" && <><th className="px-4 py-3">Borrowing complexity</th><th className="px-4 py-3">Limitations</th><th className="px-4 py-3">Confidence</th></>}
              {mode === "protection" && <><th className="px-4 py-3">Asset protection</th><th className="px-4 py-3">Key risk</th><th className="px-4 py-3">Complexity</th></>}
              {mode === "estate" && <><th className="px-4 py-3">Estate score</th><th className="px-4 py-3">Flexibility</th><th className="px-4 py-3">Limitations</th></>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {outcomes.map((outcome) => (
              <tr key={`${mode}-${outcome.structure}`}>
                <td className="px-4 py-3 font-semibold text-slate-950">{outcome.label}</td>
                {mode === "cash" && <><td className="px-4 py-3">{money(outcome.estimatedAnnualTaxableIncome)}</td><td className="px-4 py-3">{money(outcome.estimatedAnnualTax)}</td><td className="px-4 py-3 font-semibold">{money(outcome.estimatedAfterTaxAnnualCashFlow)}</td><td className="px-4 py-3">{money(outcome.tenYearAfterTaxCashFlow)}</td></>}
                {mode === "sale" && <><td className="max-w-sm px-4 py-3 text-slate-600">{outcome.indicativeCapitalGainsTreatment}</td><td className="px-4 py-3 font-semibold">{money(outcome.estimatedSaleProceedsAfterIndicativeTax)}</td><td className="px-4 py-3">{money(outcome.estimatedLifetimeCost)}</td></>}
                {mode === "borrowing" && <><td className="px-4 py-3 font-semibold">{outcome.borrowingComplexity}</td><td className="max-w-sm px-4 py-3 text-slate-600">{outcome.keyLimitations.join(" ")}</td><td className="px-4 py-3">{outcome.confidenceLevel}</td></>}
                {mode === "protection" && <><td className="px-4 py-3 font-semibold">{Math.round(outcome.assetProtectionScore)}/100</td><td className="max-w-sm px-4 py-3 text-slate-600">{outcome.keyRisks[0]?.detail}</td><td className="px-4 py-3">{outcome.administrativeComplexity}</td></>}
                {mode === "estate" && <><td className="px-4 py-3 font-semibold">{Math.round(outcome.estatePlanningScore)}/100</td><td className="px-4 py-3">{Math.round(outcome.flexibilityScore)}/100</td><td className="max-w-sm px-4 py-3 text-slate-600">{outcome.keyLimitations.join(" ")}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StructureOptimiserClient({ initialAssumptions }: { initialAssumptions: StructureAssumptionSet }) {
  const [assumptions, setAssumptions] = useState<StructureAssumptionSet>(initialAssumptions);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const comparison = useMemo(() => StructureComparisonEngine.run(assumptions), [assumptions]);

  function update<K extends keyof StructureAssumptionSet>(key: K, value: StructureAssumptionSet[K]) {
    setAssumptions((current) => ({ ...current, [key]: value }));
  }

  function updateSetupCost(structure: keyof StructureAssumptionSet["setupCosts"], value: number) {
    setAssumptions((current) => ({ ...current, setupCosts: { ...current.setupCosts, [structure]: value } }));
  }

  function updateAnnualComplianceCost(structure: keyof StructureAssumptionSet["annualComplianceCosts"], value: number) {
    setAssumptions((current) => ({ ...current, annualComplianceCosts: { ...current.annualComplianceCosts, [structure]: value } }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">Educational modelling only</div>
            <p>{comparison.disclaimer}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Scale className="h-3.5 w-3.5" />
                Tax and Ownership Structure Intelligence
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Structure Optimiser</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Compare Australian investment ownership structures using deterministic assumptions. Outputs are educational scenarios, not tax, legal or financial advice.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
              Tax rules last verified: <span className="text-slate-950">{comparison.rulesLastVerified}</span>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["Investment", INVESTMENT_TYPE_LABELS[assumptions.investmentType]],
              ["Purchase", money(assumptions.purchasePrice)],
              ["Loan", `${money(assumptions.loanAmount)} at ${pct(assumptions.interestRate)}`],
              ["Annual income", money(assumptions.expectedAnnualIncome)],
              ["Annual expenses", money(assumptions.expectedAnnualExpenses)],
              ["Holding period", `${assumptions.expectedHoldingPeriod} years`],
              ["Jurisdiction", comparison.jurisdictionUsed],
              ["Assumptions", `${comparison.assumptionCount} model inputs`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Current Financial Vault profile
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Taxable income", money(assumptions.userTaxableIncome)],
              ["Partner income", money(assumptions.partnerTaxableIncome)],
              ["State", `${assumptions.state} (${assumptions.stateOfResidenceSource})`],
              ["Vault evidence", `${assumptions.vaultEvidence.length} source fields`],
              ["Low-confidence inputs", `${comparison.lowConfidenceInputs.length}`],
              ["Professional review items", `${comparison.professionalReviewItems.length}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Vault values are used only as defaults. Assumption overrides in this workspace do not change verified Vault data.
          </p>
          {(comparison.lowConfidenceInputs.length > 0 || comparison.staleRuleWarnings.length > 0 || comparison.blockedReasons.length > 0) && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              {[...comparison.lowConfidenceInputs, ...comparison.staleRuleWarnings, ...comparison.blockedReasons].slice(0, 4).join(" ")}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["Best for annual cash flow", comparison.bestForAnnualCashFlow.label, money(comparison.bestForAnnualCashFlow.estimatedAfterTaxAnnualCashFlow), ArrowDownUp],
          ["Best for capital growth", comparison.bestForCapitalGrowth.label, money(comparison.bestForCapitalGrowth.estimatedSaleProceedsAfterIndicativeTax), Landmark],
          ["Best for asset protection", comparison.bestForAssetProtection.label, `${Math.round(comparison.bestForAssetProtection.assetProtectionScore)}/100`, ShieldCheck],
          ["Lowest administration", comparison.lowestAdministration.label, comparison.lowestAdministration.administrativeComplexity, FileText],
          ["Highest flexibility", comparison.highestFlexibility.label, `${Math.round(comparison.highestFlexibility.flexibilityScore)}/100`, SlidersHorizontal],
          ["Lowest estimated lifetime cost", comparison.lowestEstimatedLifetimeCost.label, money(comparison.lowestEstimatedLifetimeCost.estimatedLifetimeCost), Building2],
        ].map(([label, title, value, Icon]) => {
          const TypedIcon = Icon as typeof CheckCircle2;
          return (
            <article key={label as string} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <TypedIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-500">{label as string}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{title as string}</div>
                  <div className="mt-1 text-sm text-slate-600">{value as string}</div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-10 shrink-0 rounded-md px-3 text-sm font-semibold ${activeTab === tab ? "bg-[#10243b] text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "Overview" && (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-950">Lifecycle model</h2>
              <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                {comparison.outcomes[0]?.lifecycleAssessments.map((phase) => (
                  <div key={phase.phase} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-950">{phase.label}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">Modelled for every structure</div>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                <div>
                  <h2 className="text-lg font-semibold text-amber-950">No shortcut rule</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    Vireon does not use &quot;high salary + family = trust&quot;. Trusts are compared across purchase, annual ownership, financing, distributions, sale and estate transfer, including trapped losses, CGT treatment, lender policy, costs and state review flags.
                  </p>
                </div>
              </div>
            </article>
          </section>
          <section className="grid gap-4 xl:grid-cols-4">
            {comparison.outcomes.map((outcome) => <StructureCard key={outcome.structure} outcome={outcome} />)}
          </section>
          <section className="grid gap-5 lg:grid-cols-[1fr_0.86fr]">
            <article className="rounded-lg border border-blue-100 bg-blue-50 p-6">
              <h2 className="text-lg font-semibold text-blue-950">Most suitable under current assumptions</h2>
              <div className="mt-3 text-2xl font-semibold text-blue-950">
                {comparison.mostSuitableUnderCurrentAssumptions.outcome?.label ?? "No single clear structure"}
              </div>
              <div className="mt-4 space-y-2 text-sm leading-6 text-blue-900">
                {comparison.mostSuitableUnderCurrentAssumptions.why.map((item) => <p key={item}>{item}</p>)}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {comparison.mostSuitableUnderCurrentAssumptions.alternatives.map((item) => (
                  <div key={item} className="rounded-lg bg-white p-3 text-sm font-semibold text-slate-800">{item}</div>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-sm leading-6 text-blue-900">
                {comparison.mostSuitableUnderCurrentAssumptions.tradeOffs.map((item) => <p key={item}>{item}</p>)}
              </div>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-950">Professional questions</h2>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                {comparison.mostSuitableUnderCurrentAssumptions.professionalQuestions.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </article>
          </section>
        </div>
      )}

      {activeTab === "Annual Cash Flow" && <OutcomeTable outcomes={comparison.outcomes} mode="cash" />}
      {activeTab === "Sale and CGT" && <OutcomeTable outcomes={comparison.outcomes} mode="sale" />}
      {activeTab === "Borrowing" && <OutcomeTable outcomes={comparison.outcomes} mode="borrowing" />}
      {activeTab === "Asset Protection" && <OutcomeTable outcomes={comparison.outcomes} mode="protection" />}
      {activeTab === "Estate Planning" && <OutcomeTable outcomes={comparison.outcomes} mode="estate" />}

      {activeTab === "Assumptions" && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Override assumptions</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">State or territory</span>
              <select value={assumptions.state} onChange={(event) => update("state", event.target.value as AustralianJurisdiction)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950">
                {states.map((state) => <option key={state}>{state}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Investment type</span>
              <select value={assumptions.investmentType} onChange={(event) => update("investmentType", event.target.value as InvestmentType)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950">
                {investmentTypes.map((type) => <option key={type} value={type}>{INVESTMENT_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            {numberInput("Purchase price", assumptions.purchasePrice, (value) => update("purchasePrice", value))}
            {numberInput("Deposit", assumptions.deposit, (value) => update("deposit", value))}
            {numberInput("Loan amount", assumptions.loanAmount, (value) => update("loanAmount", value))}
            {numberInput("Interest rate", assumptions.interestRate, (value) => update("interestRate", value), "%")}
            {numberInput("Expected annual income", assumptions.expectedAnnualIncome, (value) => update("expectedAnnualIncome", value))}
            {numberInput("Expected annual expenses", assumptions.expectedAnnualExpenses, (value) => update("expectedAnnualExpenses", value))}
            {numberInput("Expected capital growth", assumptions.expectedCapitalGrowth, (value) => update("expectedCapitalGrowth", value), "%")}
            {numberInput("Holding period", assumptions.expectedHoldingPeriod, (value) => update("expectedHoldingPeriod", value), "years")}
            {numberInput("User taxable income", assumptions.userTaxableIncome, (value) => update("userTaxableIncome", value))}
            {numberInput("Partner taxable income", assumptions.partnerTaxableIncome, (value) => update("partnerTaxableIncome", value))}
            {numberInput("Expected sale year", assumptions.expectedSaleYear, (value) => update("expectedSaleYear", value))}
            {numberInput("Potential beneficiaries", assumptions.potentialBeneficiaries, (value) => update("potentialBeneficiaries", value))}
            {numberInput("Asset protection importance", assumptions.assetProtectionImportance, (value) => update("assetProtectionImportance", value), "/10")}
            {numberInput("Estate planning importance", assumptions.estatePlanningImportance, (value) => update("estatePlanningImportance", value), "/10")}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              ["Losses expected", "lossesExpected"],
              ["Income will be retained", "incomeRetained"],
            ].map(([label, key]) => (
              <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={Boolean(assumptions[key as keyof StructureAssumptionSet])} onChange={(event) => update(key as keyof StructureAssumptionSet, event.target.checked as never)} />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              ["Existing trust", "trust"],
              ["Existing company", "company"],
              ["Existing SMSF", "smsf"],
            ].map(([label, key]) => (
              <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={assumptions.existingStructures[key as keyof StructureAssumptionSet["existingStructures"]]}
                  onChange={(event) =>
                    setAssumptions((current) => ({
                      ...current,
                      existingStructures: {
                        ...current.existingStructures,
                        [key]: event.target.checked,
                      },
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-950">Estimated setup and annual compliance costs</h3>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Structure</th>
                      <th className="px-4 py-3">Setup cost</th>
                      <th className="px-4 py-3">Annual compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {OWNERSHIP_STRUCTURES.map((structure) => {
                      const currentOutcome = comparison.outcomes.find((outcome) => outcome.structure === structure);
                      return (
                        <tr key={structure}>
                          <td className="px-4 py-3 font-semibold text-slate-950">{STRUCTURE_LABELS[structure]}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={assumptions.setupCosts[structure] ?? currentOutcome?.setupCost ?? 0}
                              onChange={(event) => updateSetupCost(structure, Number(event.target.value))}
                              className="h-9 w-32 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-950"
                              aria-label={`${STRUCTURE_LABELS[structure]} setup cost`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={assumptions.annualComplianceCosts[structure] ?? currentOutcome?.annualComplianceCost ?? 0}
                              onChange={(event) => updateAnnualComplianceCost(structure, Number(event.target.value))}
                              className="h-9 w-32 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-950"
                              aria-label={`${STRUCTURE_LABELS[structure]} annual compliance cost`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "Evidence" && (
        <section className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-950">Output provenance</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-semibold text-slate-950">Jurisdiction used:</span> {comparison.jurisdictionUsed}</div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-semibold text-slate-950">Rules last verified:</span> {comparison.rulesLastVerified}</div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-semibold text-slate-950">Assumption count:</span> {comparison.assumptionCount}</div>
            </div>
            <div className="mt-4 space-y-3">
              {comparison.outcomes.map((outcome) => (
                <div key={`evidence-${outcome.structure}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{outcome.label}</div>
                      <div className="mt-1 text-xs font-semibold uppercase text-slate-500">Confidence {outcome.confidenceLevel} - lifecycle score {outcome.lifecycleScore}</div>
                    </div>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                      {outcome.professionalReviewItems.length} review items
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {outcome.calculationEvidence.map((item) => (
                      <div key={`${outcome.structure}-${item.outputKey}`} className="rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">
                        <div className="font-semibold text-slate-950">{item.outputKey} - {classificationLabel(item.classification)}</div>
                        <div>Rules used: {item.ruleIds.length > 0 ? item.ruleIds.join(", ") : "No applicable non-expired rule evidence"}</div>
                        <div>Assumptions: {item.assumptions.join(", ")}</div>
                        <div>Confidence: {item.confidence}</div>
                        {item.professionalReviewRequired && <div className="text-red-700">Review required: {item.professionalReviewReason}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-950">Decision Centre outputs</h2>
              <div className="mt-4 space-y-3">
              {comparison.recommendations.map((rec) => (
                <div key={rec.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">{rec.category}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">{rec.title}</div>
                    </div>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                      {rec.professionalReviewRequired ? "Professional review" : "Modelled"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{rec.financialImpact} - Confidence {rec.confidence}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">{rec.evidence.join(" ")}</div>
                </div>
              ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-950">Tax rule references</h2>
              <div className="mt-4 space-y-3">
              {comparison.outcomes.flatMap((outcome) => outcome.taxRuleReferences).filter((rule, index, all) => all.findIndex((item) => item.id === rule.id) === index).map((rule) => (
                <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">{rule.sourceTitle}</div>
                  <div className="mt-1 text-xs font-semibold uppercase text-slate-500">{rule.authority} - {rule.jurisdiction}</div>
                  <div className="mt-1 text-xs text-slate-500">Effective {rule.effectiveFrom} to {rule.effectiveTo ?? "current"} - verified {rule.lastVerifiedAt} - version {rule.ruleVersion}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{rule.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{rule.ruleType.replaceAll("_", " ")}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Confidence {rule.confidence}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{rule.reviewStatus}</span>
                    {rule.professionalReviewRequired && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">Professional review</span>}
                  </div>
                </div>
              ))}
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

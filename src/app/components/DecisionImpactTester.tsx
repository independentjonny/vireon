"use client";

import { useState } from "react";
import { decisionImpact } from "@/lib/decisionImpact";

const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
const signed = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;

export default function DecisionImpactTester() {
  const [direction, setDirection] = useState<"add" | "spend">("add");
  const [fields, setFields] = useState({ age: "", amount: "", base: "", lower: "", higher: "" });
  const [comparison, setComparison] = useState(false);
  const complete = [fields.age, fields.amount, fields.base].every(value => value.trim() !== "");
  const calculate = (rate: string) => complete && rate.trim() !== "" ? decisionImpact({ currentAge: Number(fields.age), amount: Number(fields.amount), annualReturn: Number(rate), direction }) : null;
  const result = calculate(fields.base);
  const lower = calculate(fields.lower), higher = calculate(fields.higher);
  const ordered = lower && higher && Number(fields.lower) <= Number(fields.base) && Number(fields.base) <= Number(fields.higher);
  const field = (key: keyof typeof fields, label: string, min?: number, max?: number, step = "any") => (
    <label className="cc-field">{label}<input type="number" inputMode="decimal" value={fields[key]} min={min} max={max} step={step} onChange={event => setFields({ ...fields, [key]: event.target.value })} /></label>
  );
  return <>
    <section className="cc-card cc-tester" id="decide" aria-labelledby="decision-heading">
      <p className="cc-eyebrow">04 / Decide</p><h2 id="decision-heading">Test a decision</h2>
      <p className="cc-muted">Explore the age-65 impact of a one-off change.</p>
      <div className="cc-toggle" aria-label="Decision type">
        <button type="button" aria-pressed={direction === "add"} onClick={() => setDirection("add")}>Add to investments</button>
        <button type="button" aria-pressed={direction === "spend"} onClick={() => setDirection("spend")}>Spend instead</button>
      </div>
      <div className="cc-form-grid">{field("age", "Current age", 0, 65, "1")}{field("amount", "One-off amount (AUD)", 0)}{field("base", "Annual return assumption (%)", -99.99)}</div>
      <p className="cc-muted">Enter your own inputs; no return rate or age is preselected. Values are temporary and do not update your plan.</p>
      <div className={`cc-impact ${direction === "spend" ? "cc-impact-negative" : ""}`} aria-live="polite" aria-atomic="true">
        <span>{direction === "add" ? "Additional investment value at 65" : "Age-65 difference versus investing this amount"}</span>
        <strong>{result ? signed(result.impact) : "Enter inputs to calculate"}</strong>
        {result && <p>{direction === "spend" ? "Investment value forgone" : "Projected value"}: {money(result.futureValue)} over {result.years} years. {result.growth >= 0 ? "Growth component" : "Modelled loss component"}: {money(result.growth)}.</p>}
        {complete && !result && <p role="alert">Use a whole age from 0 to 65, a non-negative amount and a finite return greater than −100%.</p>}
      </div>
      <details className="cc-details"><summary>Calculation and limitations</summary><p>Amount × (1 + annual return / 100)^(65 − current age). Annual compounding, nominal AUD. For spending, the negative value compares spending with investing that same amount today. The total opportunity cost includes the original amount; the growth component is shown separately.</p><p>This isolated illustration excludes tax, fees, inflation, debt, liquidity and changes to income. It is not your total projected wealth, an investment recommendation or a retirement-readiness assessment. Existing Vireon calculations are unchanged.</p></details>
    </section>
    <section className="cc-card cc-scenarios" aria-labelledby="scenario-heading">
      <p className="cc-eyebrow">Compare</p><h2 id="scenario-heading">Explore scenarios</h2><p className="cc-muted">Compare the same decision under your own return assumptions.</p>
      <button className="cc-link-button" type="button" onClick={() => setComparison(!comparison)} aria-expanded={comparison}>{comparison ? "Hide" : "Set"} scenario range</button>
      {comparison && <div className="cc-form-grid cc-range-fields">{field("lower", "Lower return (%)", -99.99)}{field("higher", "Higher return (%)", -99.99)}</div>}
      {comparison && lower && higher && !ordered && <p role="alert" className="cc-error">Use lower ≤ base ≤ higher return.</p>}
      <dl className="cc-scenario-list">{[["Lower return", ordered ? lower : null, fields.lower], ["Base case", result, fields.base], ["Higher return", ordered ? higher : null, fields.higher]].map(([label, value, rate]) => { const item = value as ReturnType<typeof decisionImpact>; return <div key={String(label)}><dt>{String(label)}<small>{item ? `${rate}% annually` : "Assumption needed"}</small></dt><dd>{item ? signed(item.impact) : "—"}<small>at age 65</small></dd></div>; })}</dl>
      <p className="cc-muted">Decision impact only. A scenario range is not a probability interval or guaranteed outcome.</p>
      {result && ordered && <details className="cc-details"><summary>Year-by-year comparison</summary><div className="cc-table-scroll" tabIndex={0} role="region" aria-label="Decision scenario values by age"><table><thead><tr><th>Age</th><th>Lower return</th><th>Base case</th><th>Higher return</th></tr></thead><tbody>{result.yearly.map((point, index) => <tr key={point.age}><th>{point.age}</th><td>{signed(lower.yearly[index].value)}</td><td>{signed(point.value)}</td><td>{signed(higher.yearly[index].value)}</td></tr>)}</tbody></table></div></details>}
    </section>
  </>;
}

"use client";
import { useState } from "react";
import Link from "next/link";
import {
  validateTrajectory,
  type TrajectorySettings,
} from "@/lib/wealthTrajectory";
const fields = [
  ["currentAge", "Current age"],
  ["retirementAge", "Retirement age"],
  ["annualAddition", "Annual additions to wealth (AUD)"],
  ["low", "Lower growth (% per year)"],
  ["base", "Base growth (% per year)"],
  ["high", "Higher growth (% per year)"],
  ["inflation", "Inflation (% per year)"],
] as const;
export default function TrajectorySettingsClient({
  initialSettings,
  onSaved,
}: {
  initialSettings: TrajectorySettings | null;
  onSaved: (settings: TrajectorySettings) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    initialSettings
      ? Object.fromEntries(fields.map(([k]) => [k, String(initialSettings[k])]))
      : {},
  );
  const [complete, setComplete] = useState(initialSettings?.complete ?? false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [advanced, setAdvanced] = useState(!initialSettings);
  async function save() {
    setMessage("");
    try {
      if (fields.some(([k]) => !values[k]?.trim()))
        throw Error(
          "Complete your ages and all projection assumptions. Enter 0 where appropriate.",
        );
      const settings = {
        ...Object.fromEntries(fields.map(([k]) => [k, Number(values[k])])),
        complete,
      } as TrajectorySettings;
      validateTrajectory(settings);
      setBusy(true);
      const r = await fetch("/api/financial-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-trajectory", settings }),
      });
      const d = await r.json();
      if (!r.ok || !d.trajectory)
        throw Error(d.error ?? "Could not save retirement settings.");
      onSaved(d.trajectory);
      setMessage(
        "Saved. Your Dashboard uses this retirement age and these assumptions.",
      );
    } catch (e) {
      setAdvanced(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field([key, label]: (typeof fields)[number]) {
    return (
      <label key={key} className="goals-field">
        {label}
        <input
          type="number"
          step={key.includes("Age") ? "1" : "0.01"}
          value={values[key] ?? ""}
          disabled={busy}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      </label>
    );
  }
  return (
    <form
      className="goals-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <h3>Retirement age & projection</h3>
      <p>
        Set the age you want to retire. These saved settings also update your
        Dashboard trajectory.
      </p>
      <div className="goals-fields">{fields.slice(0, 2).map(field)}</div>
      <details
        open={advanced}
        onToggle={(e) => setAdvanced(e.currentTarget.open)}
      >
        <summary>
          Projection assumptions{" "}
          {initialSettings ? "" : "· needed to calculate"}
        </summary>
        <p>
          Enter your own annual rates after tax and fees. No rates are filled in
          automatically.
        </p>
        <div className="goals-fields">{fields.slice(2).map(field)}</div>
        <p>
          Annual additions include new savings, super contributions and debt
          principal repaid, less withdrawals. Exclude mortgage interest and do
          not count the same saving twice.
        </p>
        <p>
          Growth applies to total net wealth, including property and super.
          Assumptions stay constant, returns compound annually and additions
          occur at year end. Inflation converts the base result to today’s
          money. This illustration does not assess retirement spending or
          pension eligibility.
        </p>
      </details>
      <label className="goals-check">
        <input
          type="checkbox"
          checked={complete}
          disabled={busy}
          onChange={(e) => setComplete(e.target.checked)}
        />
        I have reviewed my assets and debts, including super and investments. My
        records cover my current position; categories I do not hold are zero.
      </label>
      <p role="status">{message}</p>
      <div className="goals-actions">
        <button className="goals-primary" disabled={busy}>
          {busy ? "Saving…" : "Save retirement settings"}
        </button>
        <Link href="/financial-profile/add-data">Review financial data</Link>
        <Link href="/">View Dashboard</Link>
      </div>
    </form>
  );
}

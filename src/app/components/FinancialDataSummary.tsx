"use client";

import { setupCategories, categoryForRecord, type SetupDraft } from "@/lib/financialSetup";
import { confirmedBalance } from "@/lib/confirmedPositionSummary";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";

const money = (value: number | null) => value === null ? "Amount not recorded" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(value);
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Not recorded";
function amount(record: CanonicalFinancialRecord) {
  if (record.kind !== "income" && record.kind !== "expense") return money(confirmedBalance(record));
  const v = record.value;
  for (const [key, period] of [["amount", typeof v.frequency === "string" ? v.frequency : "frequency not recorded"], ["monthlyAmount", "monthly"], ["netMonthlyAmount", "monthly"], ["annualAmount", "annual"]]) {
    if (typeof v[key] === "number" && Number.isFinite(v[key])) return `${money(v[key] as number)} · ${period}`;
  }
  return "Amount not recorded";
}
export default function FinancialDataSummary({ records, draft }: { records: CanonicalFinancialRecord[]; draft: SetupDraft }) {
  const current = records.filter(record => !record.superseded && categoryForRecord(record));
  const confirmed = current.filter(record => record.provenance.userConfirmed && !record.approximate);
  const categories = Object.entries(setupCategories);
  return <section className="fs-data-summary" aria-labelledby="fs-data-heading">
    <div className="fs-section-title"><div><h2 id="fs-data-heading">Your data so far</h2><p>Previously saved information, separate from the changes you are preparing above.</p></div><span className="fs-tag">{confirmed.length} confirmed record{confirmed.length === 1 ? "" : "s"}</span></div>
    <div className="fs-data-grid">{categories.map(([key, category]) => {
      const items = current.filter(record => categoryForRecord(record) === key);
      return <section className="fs-data-category" key={key}><div className="fs-data-category-title"><h3>{category.label}</h3><span className="fs-muted">{items.length ? `${items.length} recorded` : "Not added"}</span></div>
        {items.length ? items.map(record => <article className="fs-data-record" key={record.id}><strong>{record.label}</strong><p className="fs-data-amount">{amount(record)}</p><>{record.kind === "liability" && typeof record.value.repaymentAmount === "number" && <p className="fs-muted">Repayment: {money(record.value.repaymentAmount)}{record.value.repaymentFrequency ? ` · ${record.value.repaymentFrequency}` : ""}</p>}</><span className={record.provenance.userConfirmed && !record.approximate ? "fs-ready" : "fs-muted"}>{record.provenance.userConfirmed && !record.approximate ? "Confirmed" : "Needs review"}</span><dl><div><dt>Effective date</dt><dd>{date(record.value.asOfDate)}</dd></div><div><dt>Last updated</dt><dd>{date(record.updatedAt)}</dd></div><div><dt>Source</dt><dd>{typeof record.value.sourceName === "string" ? record.value.sourceName : record.provenance.sourceField === "manual-entry" || record.provenance.sourceType === "MANUAL" ? "Manual entry" : "Imported record"}</dd></div></dl></article>) : <p className="fs-muted">No saved {category.label.toLowerCase()} information yet.</p>}
      </section>;
    })}</div>
    <div className="fs-data-draft"><h3>This update · not confirmed yet</h3><p>{draft.entries.filter(entry => entry.included).length} item(s) being prepared · {draft.files.length} document(s) uploaded in this draft. These have not changed your financial position.</p>
      {draft.files.length > 0 ? <ul>{draft.files.map(file => <li key={file.id}><strong>{file.name}</strong><span>{file.extracted} suggested amount(s) · needs review</span>{file.warnings.map(warning => <p className="fs-muted" key={warning}>{warning}</p>)}</li>)}</ul> : <p className="fs-muted">No documents uploaded in this draft. Items entered manually are shown above.</p>}
    </div><p className="fs-muted">Saved records may be incomplete or out of date. To change a recorded item, choose its information type and select it under “New or existing item?” above. Original uploaded files are not retained by this workflow.</p>
  </section>;
}

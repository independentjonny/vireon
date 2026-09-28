"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileText, UploadCloud, PenLine, ShieldCheck, X } from "lucide-react";
import { isMortgageFree, categoryForRecord, linkedSetupMortgage, setupCategories, validateSetupEntries, type SetupCategory, type SetupDraft, type SetupEntry, type SetupFile } from "@/lib/financialSetup";
import { confirmedBalance } from "@/lib/confirmedPositionSummary";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import "./financial-setup.css";
import FinancialDataSummary from "./FinancialDataSummary";

const formatMoney = (amount: unknown) => typeof amount === "number" ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount) : "Not recorded";
const makeDraft = (): SetupDraft => ({ id: crypto.randomUUID(), revision: 0, status: "draft", entries: [], files: [], updatedAt: "" });
const blankEntry = (category: SetupCategory = "bank", source = "Manual entry"): SetupEntry => ({ id: crypto.randomUUID(), category, label: "", amount: "", frequency: "", asOfDate: "", ownership: "", source, snippet: "", replaceId: "", replaceUpdatedAt: "", included: true });

export default function FinancialSetupClient({ initialData }: { initialData?: { drafts: SetupDraft[]; records: CanonicalFinancialRecord[] } } = {}) {
  const [asOf] = useState(() => Date.now());
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [saved, setSaved] = useState<SetupDraft[]>([]);
  const [records, setRecords] = useState<CanonicalFinancialRecord[]>([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [checked, setChecked] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step > 1) heading.current?.focus(); }, [step]);

  useEffect(() => {
    let cancelled = false;
    (initialData ? Promise.resolve({ ok: true, json: async () => initialData } as Response) : fetch("/api/financial-setup")).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your saved information.");
      if (!cancelled) { setSaved(result.drafts); setRecords(result.records); setDraft(makeDraft()); }
    }).catch(error => { if (!cancelled) setError(error.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialData]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next: SetupDraft) { setDraft(next); setDirty(true); setChecked(false); setMessage(""); }
  function edit(id: string, patch: Partial<SetupEntry>) { if (draft) change({ ...draft, entries: draft.entries.map(entry => entry.id === id ? { ...entry, ...patch } : entry) }); }
  async function persist(next: SetupDraft, confirm = false) {
    const response = await fetch("/api/financial-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: confirm ? "confirm" : "save", draft: next }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save. Your entries are still on this page.");
    setDraft(result.draft); setDirty(false);
    setSaved(items => [result.draft, ...items.filter(item => item.id !== result.draft.id)]);
    return result.draft as SetupDraft;
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError("");
    try { await persist(draft); setMessage("Draft saved to your account. You can return on another device to finish."); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function upload(files: File[]) {
    if (!draft || busy) return;
    if (files.length + draft.files.length > 20) { setError("Choose up to 20 files per update."); return; }
    setBusy(true); setError(""); let next = draft; const failures: string[] = [];
    for (const file of files) {
      setUploadStatus(`Reading ${file.name}…`);
      try {
        if (file.size > 3_900_000) throw new Error("Choose a file smaller than 3.9 MB.");
        const body = new FormData(); body.set("file", file);
        const response = await fetch("/api/financial-setup", { method: "POST", body });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not read this file.");
        const incoming = result.file as SetupFile;
        if (next.files.some(item => item.hash === incoming.hash)) { failures.push(`${file.name}: already in this draft; skipped.`); continue; }
        if (next.entries.length + result.entries.length > 50) throw new Error("This update has reached 50 items. Confirm these first.");
        next = { ...next, entries: [...next.entries, ...result.entries], files: [...next.files, incoming] };
        change(next);
      } catch (error) { failures.push(`${file.name}: ${(error as Error).message}`); }
    }
    if (next !== draft) {
      try { await persist(next); setMessage("Document suggestions saved as a draft. Your financial position has not changed."); }
      catch (error) { failures.push((error as Error).message); }
    }
    setError(failures.join(" ")); setUploadStatus(""); setBusy(false);
  }
  function review() {
    if (!draft) return;
    try { validateSetupEntries(draft.entries); setStep(3); setChecked(false); setError(""); }
    catch (error) { setError((error as Error).message); }
  }
  async function confirm() {
    if (!draft || !checked) return;
    setBusy(true); setError("");
    try { await persist(draft, true); setStep(4); setMessage(""); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const active = records.filter(record => record.provenance.userConfirmed && !record.superseded && !record.approximate && new Date(record.updatedAt).getTime() >= asOf - 180 * 86400000);
  const ready = (category: SetupCategory) => active.some(record => categoryForRecord(record) === category && (category === "income" || category === "expenses" ? typeof record.value.amount === "number" && Boolean(record.value.frequency) || typeof record.value.monthlyAmount === "number" || typeof record.value.annualAmount === "number" : confirmedBalance(record) !== null));
  const entries = draft?.entries ?? [];
  const pending = saved.filter(item => item.status === "draft");
  return <main className="fs-page">
    <header className="fs-heading"><p className="fs-eyebrow">Your financial picture</p><h1 ref={heading} tabIndex={-1}>{step === 4 ? "Your position has been updated" : "Build your financial picture"}</h1><p>Add what you have now. Review every value before it changes your position.</p></header>
    {step < 4 && <ol className="fs-steps" aria-label="Setup progress">{["Add information", "Check the details", "Confirm changes"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined}><span>{step > index + 1 ? <Check size={16} /> : index + 1}</span>{label}</li>)}</ol>}
    {error && <div className="fs-error" role="alert">{error}</div>}
    {message && <div className="fs-notice" role="status">{message}</div>}
    {loading && <p role="status">Loading your saved information…</p>}
    {!loading && !draft && <button className="fs-primary" onClick={() => window.location.reload()}>Try again</button>}
    {draft && <fieldset className="fs-workspace" disabled={busy}>
      {step === 1 && <div className="fs-layout"><section>
        {pending.length > 0 && <div className="fs-card fs-resume"><h2>Pick up where you left off</h2>{pending.map(item => <div key={item.id}><span>{item.entries.length} items · {new Date(item.updatedAt).toLocaleDateString("en-AU")}</span><button onClick={() => { setDraft(item); setDirty(false); setStep(2); setError(""); }}>Continue saved setup <ArrowRight size={15} /></button></div>)}</div>}
        <div className="fs-card fs-upload" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); }}>
          <UploadCloud size={36} aria-hidden="true" /><h2>Upload your documents</h2><p>Start with a bank statement, payslip, loan or super statement.</p>
          <label className="fs-primary fs-file-button">Choose files<input type="file" multiple accept=".pdf,.csv,.txt" aria-label="Choose financial documents" onChange={event => { void upload(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
          <p className="fs-muted">Or drop files here · PDF, CSV or TXT · up to 3.9 MB each</p><p className="fs-muted">Text-based documents work best. Photos and scanned PDFs may need manual entry.</p>
        </div>
        <div className="fs-card fs-manual"><PenLine size={24} aria-hidden="true" /><div><h2>Prefer to enter it yourself?</h2><p>Add a balance, income or expense without a document.</p></div><button className="fs-secondary" onClick={() => { change({ ...draft, entries: [...entries, blankEntry()] }); setStep(2); }}>Enter details manually</button></div>
        <div aria-live="polite">{uploadStatus}</div>
        {draft.files.length > 0 && <div className="fs-card"><h2>Your documents</h2>{draft.files.map(file => <div className="fs-document" key={file.id}><FileText size={20} aria-hidden="true" /><div><strong>{file.name}</strong><p>{file.extracted ? `${file.extracted} suggested amounts · needs review` : "Needs your help"}</p>{file.warnings.map(warning => <p className="fs-muted" key={warning}>{warning}</p>)}{!file.extracted && <button className="fs-link" onClick={() => { change({ ...draft, entries: [...entries, blankEntry("bank", file.name)] }); setStep(2); }}>Enter values from this document</button>}</div></div>)}</div>}
      </section><aside className="fs-card fs-coverage"><h2>Your setup checklist</h2><p>Based on usable confirmed records. You can add more than one item in each section.</p>{Object.entries(setupCategories).map(([key, category]) => <div key={key}><span>{category.label}</span><span className={ready(key as SetupCategory) ? "fs-ready" : "fs-muted"}>{ready(key as SetupCategory) ? "Data available" : "Not recorded"}</span></div>)}<p className="fs-muted">This is coverage, not a completeness score. Skip sections that do not apply. To confirm that you have no debts, add a loan item named “No debts” with a zero balance.</p><div className="fs-trust"><ShieldCheck size={20} /><p>Nothing updates until you confirm. Drafts belong to your signed-in account.</p></div><details><summary>What happens to uploaded files?</summary><p>We read files to suggest values. This workflow saves their names, fingerprints and extracted amount snippets with your draft; it does not retain the original files. Keep your originals.</p></details></aside></div>}
      {step === 2 && <section><div className="fs-section-title"><div><h2>Check the details</h2><p>All amounts are AUD. Enter only your share of jointly owned balances. Income is after tax.</p></div><button className="fs-secondary" onClick={() => { if (entries.length < 50) change({ ...draft, entries: [...entries, blankEntry()] }); }}>Add another item</button></div>
        {entries.length === 0 && <div className="fs-card"><p>No amounts to review yet. Add an item manually or go back to upload documents.</p></div>}
        {entries.map((entry, index) => <article className="fs-card fs-entry" key={entry.id}><div className="fs-entry-title"><h3>Item {index + 1} · {setupCategories[entry.category].label}</h3><button className="fs-icon" aria-label={`Remove item ${index + 1}`} onClick={() => change({ ...draft, entries: entries.filter(item => item.id !== entry.id) })}><X size={18} /></button></div>
          <p className="fs-source">Source: {entry.source}{entry.snippet && ` · Found: “${entry.snippet}”`}</p>
          <div className="fs-fields">
            <label>Information type<select value={entry.category} onChange={event => edit(entry.id, { category: event.target.value as SetupCategory, replaceId: "", replaceUpdatedAt: "" })}>{Object.entries(setupCategories).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
            <label>New or existing item?<select value={entry.replaceId} onChange={event => { const old = records.find(item => item.id === event.target.value); const mortgage = linkedSetupMortgage(old, records); edit(entry.id, { replaceId: old?.id ?? "", replaceUpdatedAt: old?.updatedAt ?? "", mortgageReplaceId: mortgage?.id ?? "", mortgageReplaceUpdatedAt: mortgage?.updatedAt ?? "", mortgageAmount: mortgage ? String(confirmedBalance(mortgage) ?? "") : "", repaymentAmount: String((entry.category === "property" ? mortgage : old)?.value.repaymentAmount ?? ""), repaymentFrequency: String((entry.category === "property" ? mortgage : old)?.value.repaymentFrequency ?? ""), ...(old ? { label: old.label, amount: String(confirmedBalance(old) ?? ""), asOfDate: String(old.value.asOfDate ?? ""), ownership: String(old.value.ownership ?? ""), frequency: String(old.value.frequency ?? "") } : {}) }); }}><option value="">Add a new item</option>{records.filter(record => categoryForRecord(record) === entry.category).map(record => <option key={record.id} value={record.id}>Update: {record.label}</option>)}</select></label>
            <label>Account or item name<input maxLength={120} value={entry.label} placeholder={entry.category === "income" ? "Employer or income source" : "A name you will recognise"} onChange={event => edit(entry.id, { label: event.target.value })} /></label>
            <label>{entry.category === "income" ? "Take-home amount (AUD)" : entry.category === "expenses" ? "Expense amount (AUD)" : entry.category === "property" ? "Property Value (AUD)" : "Balance / value (AUD)"}<input type="number" min="0" step="0.01" inputMode="decimal" value={entry.amount} onChange={event => edit(entry.id, { amount: event.target.value })} /></label>

            {entry.category === "property" && <label>Current Mortgage (AUD)<input type="number" min="0" step="0.01" inputMode="decimal" value={entry.mortgageAmount ?? ""} onChange={event => edit(entry.id, { mortgageAmount: event.target.value, ...(event.target.value === "0" ? { repaymentAmount: "", repaymentFrequency: "" } : {}) })} /><span className="fs-muted">Amount still owing. Enter 0 if there is no mortgage.</span></label>}

            {isMortgageFree(entry) && <p className="fs-notice">Fully paid off — no mortgage repayments required.</p>}
            {(["property", "loans"].includes(entry.category) && !isMortgageFree(entry)) && <>
              <label>Repayment amount (AUD)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={entry.repaymentAmount ?? ""} onChange={event => edit(entry.id, { repaymentAmount: event.target.value })} /><span className="fs-muted">Your regular payment, not the balance owing. Leave blank if there is no mortgage.</span></label>
              <label>Repayment frequency<select value={entry.repaymentFrequency ?? ""} onChange={event => edit(entry.id, { repaymentFrequency: event.target.value })}><option value="">Choose repayment frequency</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="annual">Yearly</option></select></label>
            </>}
            {["income", "expenses"].includes(entry.category) && <label>How often?<select value={entry.frequency} onChange={event => edit(entry.id, { frequency: event.target.value })}><option value="">Choose frequency</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="annual">Yearly</option></select></label>}
            <label>Statement / effective date<input type="date" value={entry.asOfDate} onChange={event => edit(entry.id, { asOfDate: event.target.value })} /></label>
            <label>Whose amount is this?<select value={entry.ownership} onChange={event => edit(entry.id, { ownership: event.target.value })}><option value="">Choose ownership</option><option value="Sole">Mine only</option><option value="My share of joint">My share of a joint amount</option></select></label>
          </div>
          {entry.replaceId && <p className="fs-notice">This updates the selected item; it will not add a second balance. Check the previous amount on the next screen.</p>}
          {entry.category === "property" && <p className="fs-muted">Property value, mortgage balance and repayments are saved together. Repayments feed your monthly cash flow. For rent and other property details, use <Link href="/financial-profile/add-data?legacy=property&category=property">the existing property form</Link>. Save this draft first.</p>}
        </article>)}
      </section>}

      {step === 3 && <section className="fs-card"><h2>Review your changes</h2><p>Your position will update only when you confirm below. Amounts are AUD and represent your share.</p><div className="fs-review-list">{entries.filter(entry => entry.included).map(entry => { const old = records.find(record => record.id === entry.replaceId); return <article key={entry.id}><div><span className="fs-tag">{old ? "Update" : "New"}</span><h3>{entry.label}</h3><p>{setupCategories[entry.category].label} · {entry.asOfDate} · {entry.ownership}</p><p className="fs-muted">Source: {entry.source}</p></div><div>{old && <p className="fs-muted">Previously {formatMoney(confirmedBalance(old))}{old.value.frequency ? ` / ${old.value.frequency}` : ""}</p>}<strong>{entry.category === "property" && "Property Value: "}{formatMoney(Number(entry.amount))}{entry.frequency && ["income", "expenses"].includes(entry.category) ? ` / ${entry.frequency}` : ""}</strong>{entry.category === "property" && <><p><strong>Current Mortgage: {formatMoney(Number(entry.mortgageAmount))}</strong></p>{linkedSetupMortgage(old, records) && <p className="fs-muted">Previous mortgage: {formatMoney(confirmedBalance(linkedSetupMortgage(old, records)!))}</p>}</>}{isMortgageFree(entry) && <p>Fully paid off — no repayments</p>}{!isMortgageFree(entry) && ["property", "loans"].includes(entry.category) && entry.repaymentAmount && <p>Repayment: {formatMoney(Number(entry.repaymentAmount))} · {entry.repaymentFrequency}</p>}<button className="fs-link" onClick={() => setStep(2)}>Change details</button></div></article>; })}</div>
        <label className="fs-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />I have checked these values, dates and ownership. Update my financial position with these changes.</label>
      </section>}
      {step === 4 && <section className="fs-card fs-success"><div className="fs-success-icon"><Check size={30} /></div><h2>{draft.confirmedCount} item{draft.confirmedCount === 1 ? "" : "s"} confirmed</h2><p>Your confirmed changes are saved. Updated balances and recurring amounts are available to your financial position and Dashboard.</p><div className="fs-review-list">{entries.filter(entry => entry.included).map(entry => <article key={entry.id}><div><strong>{entry.label}</strong><p>{entry.replaceId ? "Updated existing item" : "Added new item"}</p></div><strong>{entry.category === "property" && "Property Value: "}{formatMoney(Number(entry.amount))}{["income", "expenses"].includes(entry.category) ? ` / ${entry.frequency}` : ""}{entry.category === "property" && <><br />Current Mortgage: {formatMoney(Number(entry.mortgageAmount))}{!isMortgageFree(entry) && entry.repaymentAmount && <><br />Repayment: {formatMoney(Number(entry.repaymentAmount))} · {entry.repaymentFrequency}</>}</>}</strong></article>)}</div><p className="fs-muted">An age-65 forecast still needs a complete position, your age and retirement assumptions. Uploading documents alone does not create a forecast.</p><div className="fs-success-actions"><Link className="fs-primary" href="/">View Dashboard <ArrowRight size={16} /></Link><Link className="fs-secondary" href="/financial-profile">Review financial position</Link><button className="fs-link" onClick={() => window.location.reload()}>Add more information</button></div></section>}
      {step < 4 && <footer className="fs-footer"><button className="fs-link" onClick={() => { setStep(Math.max(1, step - 1)); setError(""); }} disabled={step === 1}>Back</button><span className="fs-muted">{dirty ? "Unsaved changes" : draft.updatedAt ? "Draft saved to your account" : "Your position is unchanged"}</span><button className="fs-secondary" onClick={() => void save()}>Save and finish later</button>{step === 1 ? <button className="fs-primary" disabled={!entries.length} onClick={() => setStep(2)}>Check details <ArrowRight size={16} /></button> : step === 2 ? <button className="fs-primary" disabled={!entries.length} onClick={review}>Review changes <ArrowRight size={16} /></button> : <button className="fs-primary" disabled={!checked} onClick={() => void confirm()}>Confirm and update my position <Check size={16} /></button>}</footer>}
      {step === 2 && <FinancialDataSummary records={records} draft={draft} />}
    </fieldset>}
    {busy && <p className="fs-saving" role="status">{uploadStatus || "Saving your changes…"}</p>}
  </main>;
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  House,
  Landmark,
  LockKeyhole,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

type CategoryId = "bank" | "employment" | "property" | "loans" | "tax" | "super" | "other";
type Step = 1 | 2 | 3;
type PropertyDraft = {
  address: string;
  propertyType: string;
  ownership: string;
  primaryUse: string;
  estimatedValue: string;
  purchaseDate: string;
  rentalIncome: boolean;
};

const draftKey = "vireon-add-financial-data-draft-v1";

const categories: Array<{
  id: CategoryId;
  title: string;
  detail: string;
  status: "Confirmed" | "Needs review" | "Missing" | "Not added" | "Optional";
  icon: LucideIcon;
}> = [
  { id: "bank", title: "Bank & savings", detail: "Accounts and statements", status: "Confirmed", icon: Landmark },
  { id: "employment", title: "Employment income", detail: "Payslips and employer details", status: "Needs review", icon: BriefcaseBusiness },
  { id: "property", title: "Property & rent", detail: "Ownership, value and rent", status: "Missing", icon: House },
  { id: "loans", title: "Loans & credit", detail: "Home loans, cards and other debt", status: "Missing", icon: WalletCards },
  { id: "tax", title: "Tax & ATO", detail: "Tax returns and notices of assessment", status: "Not added", icon: FileText },
  { id: "super", title: "Superannuation", detail: "Fund and statement details", status: "Confirmed", icon: CircleDollarSign },
  { id: "other", title: "Other document", detail: "Add supporting financial evidence", status: "Optional", icon: Paperclip },
];

const initialDraft: PropertyDraft = {
  address: "",
  propertyType: "House",
  ownership: "Joint",
  primaryUse: "Owner occupied",
  estimatedValue: "",
  purchaseDate: "",
  rentalIncome: false,
};

function savedDraft() {
  const stored = window.sessionStorage.getItem(draftKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as { category?: CategoryId; draft?: Partial<PropertyDraft> };
  } catch {
    window.sessionStorage.removeItem(draftKey);
    return null;
  }
}

const owningWorkflows: Record<Exclude<CategoryId, "property">, { label: string; href: string }> = {
  bank: { label: "Continue to Accounts", href: "/accounts" },
  employment: { label: "Continue to Cash Flow", href: "/cash-flow" },
  loans: { label: "Continue to Balance Sheet", href: "/balance-sheet" },
  tax: { label: "Continue to Document Vault", href: "/financial-vault" },
  super: { label: "Continue to Document Vault", href: "/financial-vault" },
  other: { label: "Continue to Document Vault", href: "/financial-vault" },
};

function statusClass(status: (typeof categories)[number]["status"]) {
  if (status === "Confirmed") return "bg-emerald-50 text-emerald-700";
  if (status === "Needs review") return "bg-amber-50 text-amber-700";
  if (status === "Missing") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function Stepper({ step }: { step: Step }) {
  const steps = ["Choose information", "Add details & evidence", "Review & confirm"];
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Financial data workflow progress">
      {steps.map((label, index) => {
        const number = (index + 1) as Step;
        const complete = number < step;
        const active = number === step;
        return (
          <li key={label} className="flex items-center gap-3">
            <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold " + (complete || active ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-500")}>
              {complete ? <Check className="h-4 w-4" /> : number}
            </span>
            <span className={"text-sm font-semibold " + (active ? "text-blue-700" : "text-slate-600")}>{label}</span>
            {number < 3 ? <span className="hidden h-px flex-1 bg-slate-200 xl:block" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const controlClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function AddFinancialDataClient() {
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get("category") as CategoryId | null;
  const [step, setStep] = useState<Step>(requestedCategory && categories.some((item) => item.id === requestedCategory) ? 2 : 1);
  const [category, setCategory] = useState<CategoryId>(requestedCategory && categories.some((item) => item.id === requestedCategory) ? requestedCategory : "property");
  const [draft, setDraft] = useState<PropertyDraft>(initialDraft);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = savedDraft();
      if (!stored) return;
      if (!requestedCategory && stored.category && categories.some((item) => item.id === stored.category)) setCategory(stored.category);
      if (stored.draft) setDraft((current) => ({ ...current, ...stored.draft }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedCategory]);

  const selected = categories.find((item) => item.id === category) ?? categories[2];
  const propertyFlow = category === "property";
  const reviewRows = useMemo(() => [
    ["Property address", draft.address || "Not provided", draft.address ? "High" : "Not found"],
    ["Property type", draft.propertyType, "High"],
    ["Ownership", draft.ownership, "Check"],
    ["Primary use", draft.primaryUse, "High"],
    ["Estimated value", draft.estimatedValue || "Not provided", draft.estimatedValue ? "Check" : "Not found"],
    ["Purchase date", draft.purchaseDate || "Not provided", draft.purchaseDate ? "High" : "Not found"],
  ] as const, [draft]);
  const confirmedCount = reviewRows.filter((row) => row[2] !== "Not found").length;

  function saveDraft() {
    window.sessionStorage.setItem(draftKey, JSON.stringify({ category, draft }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  function update<K extends keyof PropertyDraft>(key: K, value: PropertyDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-7 pb-10">
      <header>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Financial profile</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {step === 1 ? "Add financial data" : step === 2 ? `Add ${selected.id === "property" ? "property details" : selected.title.toLowerCase()}` : "Review property information"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          {step === 1
            ? "Choose what you want to add. Vireon will guide you through the right evidence and confirm every value before it updates your position."
            : step === 2
              ? "Tell us the key details, then add evidence so Vireon can verify the information."
              : "Check the values you entered and any extracted evidence. Nothing updates your financial position until confirmation is completed in Import Review."}
        </p>
      </header>

      <Stepper step={step} />

      {step === 1 ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">What would you like to add?</h2>
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Sparkles className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><div className="font-semibold text-slate-950">Recommended next</div><div className="mt-1 text-sm text-slate-600">Add property and loan details to complete your net worth.</div></div>
              <button type="button" onClick={() => { setCategory("property"); setStep(2); }} className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Start with property</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {categories.map((item) => {
                const active = item.id === category;
                return (
                  <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={"flex min-h-[88px] items-center gap-3 rounded-xl border p-4 text-left transition " + (active ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-200" : "border-slate-200 hover:border-blue-200 hover:bg-slate-50")}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><item.icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-950">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></span>
                    <span className="flex flex-col items-end gap-2"><span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + statusClass(item.status)}>{item.status}</span><span className={"h-4 w-4 rounded-full border " + (active ? "border-4 border-blue-600" : "border-slate-300")} /></span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
              <h2 className="font-semibold text-slate-950">Your progress</h2>
              <div className="mt-5 grid grid-cols-2 divide-x divide-slate-200"><div className="pr-3"><div className="text-2xl font-semibold">21</div><div className="text-xs text-slate-500">confirmed sources</div></div><div className="pl-3"><div className="text-2xl font-semibold">19</div><div className="text-xs text-slate-500">need review</div></div></div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-[53%] rounded-full bg-blue-700" /></div><div className="mt-2 text-xs font-semibold text-blue-700">53% reviewed</div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)]"><h2 className="font-semibold text-slate-950">How it works</h2><ol className="mt-4 space-y-4 text-sm text-slate-600">{["Add the key details", "Upload or connect evidence", "Review extracted values"].map((item, index) => <li key={item} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-300 text-xs font-semibold text-blue-700">{index + 1}</span>{item}</li>)}</ol><div className="mt-5 flex gap-3 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500"><ShieldCheck className="h-5 w-5 shrink-0" />Nothing updates your position until you confirm it.</div></section>
          </aside>
        </div>
      ) : step === 2 ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 sm:px-6"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><House className="h-5 w-5" /></span><h2 className="font-semibold text-slate-950">{selected.title}</h2><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">In progress</span><button type="button" onClick={() => setStep(1)} className="ml-auto text-sm font-semibold text-blue-700">Change category</button></div>
            {propertyFlow ? <div className="p-5 sm:p-6">
              <h3 className="font-semibold text-slate-950">1. Property details</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Property address" full><input value={draft.address} onChange={(event) => update("address", event.target.value)} placeholder="Enter the property address" className={controlClass} /></Field>
                <Field label="Property type"><select value={draft.propertyType} onChange={(event) => update("propertyType", event.target.value)} className={controlClass}><option>House</option><option>Apartment</option><option>Townhouse</option><option>Land</option></select></Field>
                <Field label="Ownership"><select value={draft.ownership} onChange={(event) => update("ownership", event.target.value)} className={controlClass}><option>Sole</option><option>Joint</option><option>Trust</option><option>Company</option></select></Field>
                <Field label="Primary use"><select value={draft.primaryUse} onChange={(event) => update("primaryUse", event.target.value)} className={controlClass}><option>Owner occupied</option><option>Investment</option><option>Secondary residence</option></select></Field>
                <Field label="Estimated value"><input inputMode="decimal" value={draft.estimatedValue} onChange={(event) => update("estimatedValue", event.target.value)} placeholder="$0" className={controlClass} /></Field>
                <Field label="Purchase date"><input type="date" value={draft.purchaseDate} onChange={(event) => update("purchaseDate", event.target.value)} className={controlClass} /></Field>
              </div>
              <label className="mt-4 flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={draft.rentalIncome} onChange={(event) => update("rentalIncome", event.target.checked)} className="h-4 w-4 accent-blue-700" />This property earns rental income</label>
            </div> : <div className="p-5 sm:p-6"><div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5"><h3 className="font-semibold text-slate-950">Continue in the owning Vireon workspace</h3><p className="mt-2 text-sm leading-6 text-slate-600">{selected.title} already has a canonical workspace. Continue there to add structured details, or use Document Vault for supporting evidence.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link href={owningWorkflows[category as Exclude<CategoryId, "property">].href} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">{owningWorkflows[category as Exclude<CategoryId, "property">].label}</Link><Link href="/financial-vault" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-700">Add supporting evidence</Link></div></div></div>}
            <div className="border-t border-slate-200 p-5 sm:p-6"><h3 className="font-semibold text-slate-950">{propertyFlow ? "2. Add supporting evidence" : "Supporting evidence"}</h3><div className="mt-4 flex min-h-[175px] flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-6 text-center"><UploadCloud className="h-7 w-7 text-blue-700" /><div className="mt-3 font-semibold text-slate-950">Add {propertyFlow ? "property documents" : selected.title.toLowerCase()} in Document Vault</div><div className="mt-1 text-sm text-slate-500">Evidence remains linked to its source and requires review before it becomes an active fact.</div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link href="/financial-vault" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-700">Choose from Document Vault</Link><Link href="/financial-vault" className="inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold text-blue-700">Upload new documents</Link></div></div><div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4" />Documents are securely stored and reviewed in Document Vault.</div></div>
          </section>
          <aside className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">What we’ll verify</h2><ul className="mt-4 space-y-3 text-sm text-slate-600">{["Ownership and address", "Current value", "Rental income, if applicable", "Related loan details"].map((item) => <li key={item} className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-blue-700" />{item}</li>)}</ul></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Your privacy</h2><p className="mt-3 flex gap-3 text-sm leading-6 text-slate-600"><ShieldCheck className="h-5 w-5 shrink-0" />Vireon only uses confirmed information in your financial position.</p></section></aside>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-6">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><House className="h-5 w-5" /></span><div><h2 className="font-semibold text-slate-950">{draft.address || "Property details"}</h2><div className="mt-1 text-xs text-slate-500">Source: manual entry; evidence remains managed by Document Vault</div></div><span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Review required</span></div>
            <h3 className="mt-6 font-semibold text-slate-950">Confirm entered values</h3>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="w-10 py-3"><span className="sr-only">Selected</span></th><th className="py-3 font-semibold">Information</th><th className="py-3 font-semibold">Entered value</th><th className="py-3 font-semibold">Confidence</th><th className="py-3 font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{reviewRows.map(([label, value, confidence]) => <tr key={label}><td className="py-3"><input type="checkbox" defaultChecked={confidence !== "Not found"} className="h-4 w-4 accent-blue-700" aria-label={`Confirm ${label}`} /></td><td className="py-3 font-medium text-slate-700">{label}</td><td className="py-3 text-slate-950">{value}</td><td className="py-3"><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (confidence === "High" ? "bg-emerald-50 text-emerald-700" : confidence === "Check" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{confidence}</span></td><td className="py-3"><button type="button" onClick={() => setStep(2)} className="font-semibold text-blue-700">{confidence === "Not found" ? "Add" : "Edit"}</button></td></tr>)}</tbody></table></div>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="font-semibold text-amber-900">Review values marked Check</div><div className="mt-1 text-sm text-amber-800">These values need supporting evidence before they can become active financial facts.</div></div>
            <div className="mt-6"><h3 className="font-semibold text-slate-950">Related information</h3><div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><Landmark className="h-5 w-5 text-slate-500" /><div className="flex-1"><div className="font-semibold text-slate-800">Home loan</div><div className="mt-1 text-xs text-slate-500">Link the loan so Vireon can calculate equity and net worth.</div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Not linked</span><button type="button" onClick={() => { setCategory("loans"); setStep(2); }} className="min-h-10 rounded-xl border border-blue-300 px-4 text-sm font-semibold text-blue-700">Add loan details</button></div></div>
          </section>
          <aside className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Source & provenance</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-xs text-slate-500">Source</dt><dd className="mt-1 font-medium text-slate-800">Manual entry</dd></div><div><dt className="text-xs text-slate-500">Evidence</dt><dd className="mt-1 font-medium text-slate-800">Document Vault</dd></div></dl><Link href="/financial-vault" className="mt-4 inline-flex text-sm font-semibold text-blue-700">View sources</Link></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">What happens next?</h2><div className="mt-4 space-y-4 text-sm leading-6 text-slate-600"><p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />Import Review confirms evidence-backed values before they become active facts.</p><p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />Unconfirmed values remain in review and are never treated as zero.</p></div></section></aside>
        </div>
      )}

      <footer className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
        {step === 1 ? <Link href="/financial-profile" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" />Back to Financial Position</Link> : <button type="button" onClick={() => setStep(step === 2 ? 1 : 2)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" />{step === 2 ? "Back" : "Back to details"}</button>}
        <div className="flex-1" />
        {saved ? <span role="status" className="text-sm font-semibold text-emerald-700">Draft saved for this session</span> : null}
        <button type="button" onClick={saveDraft} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50">Save and finish later</button>
        {step === 1 ? <button type="button" onClick={() => setStep(2)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Continue<ArrowRight className="h-4 w-4" /></button> : step === 2 ? propertyFlow ? <button type="button" onClick={() => setStep(3)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Review details<ArrowRight className="h-4 w-4" /></button> : <Link href={owningWorkflows[category as Exclude<CategoryId, "property">].href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">{owningWorkflows[category as Exclude<CategoryId, "property">].label}<ArrowRight className="h-4 w-4" /></Link> : <Link href="/financial-vault/imports" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Continue to Import Review ({confirmedCount})<ArrowRight className="h-4 w-4" /></Link>}
      </footer>
    </div>
  );
}

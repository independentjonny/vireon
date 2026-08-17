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
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
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
import AustralianAddressAutocomplete, { type AustralianAddressSelection } from "./AustralianAddressAutocomplete";
import type { AddFinancialDataCategoryId, AddFinancialDataCategoryStatus, AddFinancialDataSummary, ExistingPropertyDraft } from "@/lib/addFinancialDataStatus";
import { propertyWorkflowPresentation, propertyWorkflowState, type PropertyWorkflowState } from "@/lib/propertyWorkflowState";

type CategoryId = AddFinancialDataCategoryId;
type Step = 1 | 2 | 3;
type VaultDocumentSummary = {
  id: string;
  fileName: string;
  documentType: "bank_statement" | "payslip" | "tax_return" | "mortgage_statement" | "super_statement";
  uploadedAt: string;
  status: "uploaded" | "processing" | "extracted" | "needs_review" | "failed";
};
type PropertyDraft = {
  address: string;
  addressId: string;
  addressLocality: string;
  addressState: string;
  addressPostcode: string;
  addressSource: "manual" | "geoscape-gnaf";
  propertyType: string;
  ownership: string;
  primaryUse: string;
  estimatedValue: string;
  purchaseDate: string;
  rentalIncome: boolean;
  rentalIncomeAmount: string;
  rentalIncomeFrequency: string;
  hasMortgage: boolean;
  lender: string;
  loanBalance: string;
  interestRate: string;
  repaymentAmount: string;
  repaymentFrequency: string;
  repaymentType: string;
  rateType: string;
  offsetBalance: string;
  selectedDocuments: VaultDocumentSummary[];
};

const draftKey = "vireon-add-financial-data-draft-v1";

const categoryDefinitions: Array<{
  id: CategoryId;
  title: string;
  detail: string;
  icon: LucideIcon;
}> = [
  { id: "bank", title: "Bank & savings", detail: "Accounts and statements", icon: Landmark },
  { id: "employment", title: "Employment income", detail: "Payslips and employer details", icon: BriefcaseBusiness },
  { id: "property", title: "Property & rent", detail: "Ownership, value and rent", icon: House },
  { id: "loans", title: "Loans & credit", detail: "Home loans, cards and other debt", icon: WalletCards },
  { id: "tax", title: "Tax & ATO", detail: "Tax returns and notices of assessment", icon: FileText },
  { id: "super", title: "Superannuation", detail: "Fund and statement details", icon: CircleDollarSign },
  { id: "other", title: "Other document", detail: "Add supporting financial evidence", icon: Paperclip },
];

const initialDraft: PropertyDraft = {
  address: "",
  addressId: "",
  addressLocality: "",
  addressState: "",
  addressPostcode: "",
  addressSource: "manual",
  propertyType: "House",
  ownership: "Joint",
  primaryUse: "Owner occupied",
  estimatedValue: "",
  purchaseDate: "",
  rentalIncome: false,
  rentalIncomeAmount: "",
  rentalIncomeFrequency: "Weekly",
  hasMortgage: false,
  lender: "",
  loanBalance: "",
  interestRate: "",
  repaymentAmount: "",
  repaymentFrequency: "Monthly",
  repaymentType: "Principal and interest",
  rateType: "Variable",
  offsetBalance: "",
  selectedDocuments: [],
};

const documentTypeLabels: Record<VaultDocumentSummary["documentType"], string> = {
  bank_statement: "Bank statement",
  payslip: "Payslip",
  tax_return: "Tax return",
  mortgage_statement: "Mortgage statement",
  super_statement: "Super statement",
};

function documentStatusLabel(status: VaultDocumentSummary["status"]) {
  if (status === "needs_review") return "Needs review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function moneyLabel(value: string) {
  const amount = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(amount)
    : "Value not provided";
}

function savedDraft() {
  const stored = window.sessionStorage.getItem(draftKey);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { category?: CategoryId; draft?: Partial<PropertyDraft> };
    if (parsed.draft) Reflect.deleteProperty(parsed.draft, ["loan", "Purpose"].join(""));
    return parsed;
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

function statusClass(status: AddFinancialDataCategoryStatus) {
  if (status === "Confirmed") return "bg-emerald-50 text-emerald-700";
  if (status === "Needs review") return "bg-amber-50 text-amber-700";
  if (status === "Missing") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function Stepper({ step, workflowState }: { step: Step; workflowState: PropertyWorkflowState }) {
  const presentation = propertyWorkflowPresentation(workflowState);
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Financial data workflow progress">
      {presentation.steps.map((label, index) => {
        const number = (index + 1) as Step;
        const confirmedComplete = presentation.completedSteps[index];
        const complete = confirmedComplete || number < step;
        const active = number === step;
        return (
          <li key={label} className="flex items-center gap-3">
            <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold " + (confirmedComplete ? "border-emerald-600 bg-emerald-600 text-white" : complete || active ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-500")}>
              {complete ? <Check className="h-4 w-4" /> : number}
            </span>
            <span className={"text-sm font-semibold " + (confirmedComplete ? "text-emerald-700" : active ? "text-blue-700" : "text-slate-600")}>{label}</span>
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

export default function AddFinancialDataClient({ summary, existingProperty, savedProperties }: { summary: AddFinancialDataSummary; existingProperty: ExistingPropertyDraft | null; savedProperties: ExistingPropertyDraft[] }) {
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get("category") as CategoryId | null;
  const categories = categoryDefinitions.map((item) => ({ ...item, status: summary.categoryStatuses[item.id] }));
  const [step, setStep] = useState<Step>(requestedCategory && categoryDefinitions.some((item) => item.id === requestedCategory) ? 2 : 1);
  const [category, setCategory] = useState<CategoryId>(requestedCategory && categoryDefinitions.some((item) => item.id === requestedCategory) ? requestedCategory : summary.recommendedCategory);
  const [draft, setDraft] = useState<PropertyDraft>(() => existingProperty ? { ...initialDraft, ...existingProperty } : initialDraft);
  const [editingExisting, setEditingExisting] = useState(Boolean(existingProperty));
  const [saved, setSaved] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultDocuments, setVaultDocuments] = useState<VaultDocumentSummary[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<VaultDocumentSummary["documentType"]>("mortgage_statement");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submissionKey, setSubmissionKey] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (existingProperty) return;
      const stored = savedDraft();
      if (!stored) return;
      if (!requestedCategory && stored.category && categoryDefinitions.some((item) => item.id === stored.category)) setCategory(stored.category);
      if (stored.draft) setDraft((current) => ({ ...current, ...stored.draft }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [existingProperty, requestedCategory]);

  const selected = categories.find((item) => item.id === category) ?? categories[2];
  const propertyFlow = category === "property";
  const originalDraft = useMemo<PropertyDraft>(() => existingProperty ? { ...initialDraft, ...existingProperty } : initialDraft, [existingProperty]);
  const draftFingerprint = (value: PropertyDraft) => JSON.stringify({
    ...value,
    selectedDocuments: value.selectedDocuments.map((document) => document.id).sort(),
  });
  const hasPendingChanges = editingExisting && draftFingerprint(draft) !== draftFingerprint(originalDraft);
  const propertyState = propertyWorkflowState(editingExisting && propertyFlow, hasPendingChanges);
  const propertyPresentation = propertyWorkflowPresentation(propertyState);
  const reviewRows = useMemo(() => {
    const rows: Array<readonly [string, string, "High" | "Check" | "Not found"]> = [
      ["Property address", draft.address || "Not provided", draft.addressId ? "High" : draft.address ? "Check" : "Not found"],
      ["Property type", draft.propertyType, "High"],
      ["Ownership", draft.ownership, "Check"],
      ["Primary use", draft.primaryUse, "High"],
      ["Estimated value", draft.estimatedValue || "Not provided", draft.estimatedValue ? "Check" : "Not found"],
      ["Purchase date", draft.purchaseDate || "Not provided", draft.purchaseDate ? "High" : "Not found"],
    ];
    if (draft.rentalIncome) rows.push(["Rental income", draft.rentalIncomeAmount ? `${draft.rentalIncomeAmount} ${draft.rentalIncomeFrequency.toLowerCase()}` : "Not provided", draft.rentalIncomeAmount ? "Check" : "Not found"]);
    if (draft.hasMortgage) rows.push(
      ["Mortgage lender", draft.lender || "Not provided", draft.lender ? "Check" : "Not found"],
      ["Mortgage balance", draft.loanBalance || "Not provided", draft.loanBalance ? "Check" : "Not found"],
      ["Interest rate", draft.interestRate ? `${draft.interestRate}%` : "Not provided", draft.interestRate ? "Check" : "Not found"],
      ["Repayment", draft.repaymentAmount ? `${draft.repaymentAmount} ${draft.repaymentFrequency.toLowerCase()}` : "Not provided", draft.repaymentAmount ? "Check" : "Not found"],
      ["Loan structure", `${draft.repaymentType} · ${draft.rateType}`, "Check"],
      ["Offset balance", draft.offsetBalance || "Not provided", draft.offsetBalance ? "Check" : "Not found"],
    );
    return rows;
  }, [draft]);
  function saveDraft() {
    window.sessionStorage.setItem(draftKey, JSON.stringify({ category, draft }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  function update<K extends keyof PropertyDraft>(key: K, value: PropertyDraft[K]) {
    setSubmissionKey("");
    setSubmitError("");
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateAddress(address: string, selection: AustralianAddressSelection | null) {
    setSubmissionKey("");
    setSubmitError("");
    setDraft((current) => ({
      ...current,
      address,
      addressId: selection?.id ?? "",
      addressLocality: selection?.locality ?? "",
      addressState: selection?.state ?? "",
      addressPostcode: selection?.postcode ?? "",
      addressSource: selection?.provider ?? "manual",
    }));
  }

  function startAnotherProperty() {
    setDraft(initialDraft);
    setEditingExisting(false);
    setSubmissionKey("");
    setSubmitError("");
  }

  async function loadVaultDocuments() {
    if (vaultLoading) return;
    setVaultLoading(true);
    setVaultError("");
    try {
      const response = await fetch("/api/financial-vault", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json() as { ok?: boolean; error?: string; vault?: { uploaded_documents?: VaultDocumentSummary[] } };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Document Vault could not be loaded.");
      setVaultDocuments(payload.vault?.uploaded_documents ?? []);
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : "Document Vault could not be loaded.");
    } finally {
      setVaultLoading(false);
    }
  }

  function openVaultPicker() {
    const nextOpen = !vaultOpen;
    setVaultOpen(nextOpen);
    if (nextOpen && vaultDocuments.length === 0) void loadVaultDocuments();
  }

  function toggleDocument(document: VaultDocumentSummary) {
    setSubmissionKey("");
    setSubmitError("");
    setDraft((current) => {
      const selected = current.selectedDocuments.some((item) => item.id === document.id);
      return {
        ...current,
        selectedDocuments: selected
          ? current.selectedDocuments.filter((item) => item.id !== document.id)
          : [...current.selectedDocuments, document],
      };
    });
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile || uploadBusy) return;
    setUploadBusy(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.set("file", uploadFile);
      form.set("documentType", uploadType);
      const response = await fetch("/api/financial-vault", { method: "POST", body: form, credentials: "same-origin" });
      const payload = await response.json() as { ok?: boolean; error?: string; vault?: { uploaded_documents?: VaultDocumentSummary[] } };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The document could not be uploaded.");
      const documents = payload.vault?.uploaded_documents ?? [];
      const uploaded = documents.find((document) => document.fileName === uploadFile.name && document.documentType === uploadType);
      setVaultDocuments(documents);
      if (uploaded) setDraft((current) => ({ ...current, selectedDocuments: current.selectedDocuments.some((item) => item.id === uploaded.id) ? current.selectedDocuments : [...current.selectedDocuments, uploaded] }));
      setUploadFile(null);
      setUploadOpen(false);
      setVaultOpen(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The document could not be uploaded.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function confirmProperty() {
    if (submitBusy) return;
    if (!draft.address.trim()) {
      setSubmitError("Enter the property address before saving.");
      setStep(2);
      return;
    }
    const estimatedValue = Number(draft.estimatedValue.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
      setSubmitError("Enter a positive estimated property value before saving.");
      setStep(2);
      return;
    }
    if (draft.hasMortgage && (!draft.lender.trim() || !Number.isFinite(Number(draft.loanBalance.replace(/[$,\s]/g, ""))))) {
      setSubmitError("Enter the mortgage lender and a valid outstanding balance before saving.");
      setStep(2);
      return;
    }
    const rentAmount = Number(draft.rentalIncomeAmount.replace(/[$,\s]/g, ""));
    if (draft.rentalIncome && (!Number.isFinite(rentAmount) || rentAmount <= 0)) {
      setSubmitError("Enter a positive rent amount and payment frequency.");
      setStep(2);
      return;
    }

    const key = submissionKey || window.crypto.randomUUID();
    if (!submissionKey) setSubmissionKey(key);
    setSubmitBusy(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/financial-vault/imports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          action: "save-property-position",
          ...draft,
          selectedDocuments: undefined,
          documentIds: draft.selectedDocuments.map((document) => document.id),
        }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The property could not be saved.");
      window.sessionStorage.removeItem(draftKey);
      window.location.assign("/financial-profile?saved=property");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The property could not be saved.");
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-7 pb-10">
      <header>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Financial profile</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {step === 1 ? "Add financial data" : step === 2 ? `${editingExisting && selected.id === "property" ? "View or update" : "Add"} ${selected.id === "property" ? "property details" : selected.title.toLowerCase()}` : editingExisting && !hasPendingChanges ? "Confirmed property summary" : editingExisting ? "Review property changes" : "Review property information"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          {step === 1
            ? "Choose what you want to add. Vireon will guide you through the right evidence and confirm every value before it updates your position."
            : step === 2
              ? editingExisting && propertyFlow
                ? hasPendingChanges
                  ? "You are editing a confirmed property record. Review your changes before updating Financial Position."
                  : "This is the confirmed information currently saved in Financial Position. Make a change only when the property information needs updating."
                : "Tell us the key details, then add evidence so Vireon can verify the information."
              : editingExisting && !hasPendingChanges
                ? "These property and mortgage details have already been reviewed, accepted and saved in Financial Position."
                : editingExisting
                  ? "Compare the changes below, then confirm to update the saved property record."
                : "Check the values, then confirm to save your current property and mortgage details to Financial Position. Supporting documents remain available for evidence review."}
        </p>
      </header>

      <Stepper step={step} workflowState={propertyFlow ? propertyState : "new"} />

      {step === 1 ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">What would you like to add?</h2>
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Sparkles className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><div className="font-semibold text-slate-950">Recommended next</div><div className="mt-1 text-sm text-slate-600">{summary.recommendation}</div></div>
              <button type="button" onClick={() => { setCategory(summary.recommendedCategory); setStep(2); }} className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">{summary.recommendationAction}</button>
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
              <div className="mt-5 grid grid-cols-2 divide-x divide-slate-200"><div className="pr-3"><div className="text-2xl font-semibold">{summary.confirmedSources}</div><div className="text-xs text-slate-500">confirmed sources</div></div><div className="pl-3"><div className="text-2xl font-semibold">{summary.needsReview}</div><div className="text-xs text-slate-500">need review</div></div></div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-700" style={{ width: `${summary.reviewedPercent}%` }} /></div><div className="mt-2 text-xs font-semibold text-blue-700">{summary.reviewedPercent}% reviewed</div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)]"><h2 className="font-semibold text-slate-950">How it works</h2><ol className="mt-4 space-y-4 text-sm text-slate-600">{["Add the key details", "Upload or connect evidence", "Review extracted values"].map((item, index) => <li key={item} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-300 text-xs font-semibold text-blue-700">{index + 1}</span>{item}</li>)}</ol><div className="mt-5 flex gap-3 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500"><ShieldCheck className="h-5 w-5 shrink-0" />Nothing updates your position until you confirm it.</div></section>
          </aside>
        </div>
      ) : step === 2 ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 sm:px-6"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><House className="h-5 w-5" /></span><h2 className="font-semibold text-slate-950">{selected.title}</h2><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (editingExisting && propertyFlow ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{editingExisting && propertyFlow ? "Confirmed" : "In progress"}</span><div className="ml-auto flex items-center gap-3">{editingExisting && propertyFlow ? <button type="button" onClick={startAnotherProperty} className="text-sm font-semibold text-blue-700">Add another property</button> : null}<button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-blue-700">Change category</button></div></div>
            {propertyFlow ? <div className="p-5 sm:p-6">
              {editingExisting ? <div className={"mb-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between " + (hasPendingChanges ? "border-blue-200 bg-blue-50/60" : "border-emerald-200 bg-emerald-50/60")}><div><div className={"text-sm font-semibold " + (hasPendingChanges ? "text-blue-900" : "text-emerald-900")}>Record status: Confirmed</div><div className={"mt-1 text-xs " + (hasPendingChanges ? "text-blue-700" : "text-emerald-700")}>Current action: {hasPendingChanges ? "Editing saved details" : "Viewing saved details"}</div></div><div className="text-xs font-medium text-slate-600">Property ID: <span className="font-mono">{existingProperty?.recordId}</span></div></div> : null}
              {savedProperties.length > 1 ? <section className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="saved-properties-heading"><div className="flex items-center justify-between gap-3"><div><h3 id="saved-properties-heading" className="font-semibold text-slate-950">Your saved properties</h3><p className="mt-1 text-xs text-slate-500">Choose a confirmed property to view or update its current details.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{savedProperties.length} properties</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{savedProperties.map((property) => { const active = editingExisting && existingProperty?.recordId === property.recordId; return <Link key={property.recordId} href={`/financial-profile/add-data?category=property&propertyId=${encodeURIComponent(property.recordId)}`} aria-current={active ? "page" : undefined} className={"flex min-w-0 items-center gap-3 rounded-xl border p-3 transition " + (active ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-300")}><span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full " + (active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600")}><House className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{property.address}</span><span className="mt-1 flex items-center gap-2"><span className="text-xs text-slate-500">{moneyLabel(property.estimatedValue)}</span><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Confirmed</span></span></span>{active ? <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-700" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />}</Link>; })}</div></section> : null}
              {editingExisting ? <div role="status" className="mb-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" /><div><div className="font-semibold">Showing your current saved property details</div><div className="mt-1 text-emerald-800">Review or change any field below. Nothing is replaced until you confirm the update.</div></div></div> : null}
              <h3 className="font-semibold text-slate-950">1. Property details</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><div className="mb-1.5 text-sm font-semibold text-slate-700">Property address</div><AustralianAddressAutocomplete value={draft.address} selectionId={draft.addressId} onChange={updateAddress} /></div>
                <Field label="Property type"><select value={draft.propertyType} onChange={(event) => update("propertyType", event.target.value)} className={controlClass}><option>House</option><option>Apartment</option><option>Townhouse</option><option>Land</option></select></Field>
                <Field label="Ownership"><select value={draft.ownership} onChange={(event) => update("ownership", event.target.value)} className={controlClass}><option>Sole</option><option>Joint</option><option>Trust</option><option>Company</option></select></Field>
                <Field label="Primary use"><select value={draft.primaryUse} onChange={(event) => update("primaryUse", event.target.value)} className={controlClass}><option>Owner occupied</option><option>Investment</option><option>Secondary residence</option></select></Field>
                <Field label="Estimated value"><input inputMode="decimal" value={draft.estimatedValue} onChange={(event) => update("estimatedValue", event.target.value)} placeholder="$0" className={controlClass} /></Field>
                <Field label="Purchase date"><input type="date" value={draft.purchaseDate} onChange={(event) => update("purchaseDate", event.target.value)} className={controlClass} /></Field>
              </div>
              <label className="mt-4 flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={draft.rentalIncome} onChange={(event) => update("rentalIncome", event.target.checked)} className="h-4 w-4 accent-blue-700" />This property earns rental income</label>
              {draft.rentalIncome ? <div className="mt-4 grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-2">
                <Field label="Rent received"><input inputMode="decimal" value={draft.rentalIncomeAmount} onChange={(event) => update("rentalIncomeAmount", event.target.value)} placeholder="$0" className={controlClass} /></Field>
                <Field label="Rent frequency"><select value={draft.rentalIncomeFrequency} onChange={(event) => update("rentalIncomeFrequency", event.target.value)} className={controlClass}><option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>Quarterly</option><option>Annual</option></select></Field>
                <p className="text-xs leading-5 text-emerald-800 sm:col-span-2">Confirmed rent is normalised to a monthly value and included in monthly cash flow.</p>
              </div> : null}
              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1"><h3 className="font-semibold text-slate-950">2. Mortgage or home loan</h3><p className="mt-1 text-sm leading-6 text-slate-500">Add the current loan linked to this property so your balance, repayments and net worth stay up to date.</p></div>
                  <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={draft.hasMortgage} onChange={(event) => update("hasMortgage", event.target.checked)} className="h-4 w-4 accent-blue-700" />This property has a mortgage</label>
                </div>
                {draft.hasMortgage ? <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
                  <Field label="Lender"><input value={draft.lender} onChange={(event) => update("lender", event.target.value)} placeholder="e.g. Commonwealth Bank" className={controlClass} /></Field>
                  <Field label="Outstanding balance"><input inputMode="decimal" value={draft.loanBalance} onChange={(event) => update("loanBalance", event.target.value)} placeholder="$0" className={controlClass} /></Field>
                  <Field label="Interest rate"><div className="relative"><input inputMode="decimal" value={draft.interestRate} onChange={(event) => update("interestRate", event.target.value)} placeholder="0.00" className={controlClass + " pr-9"} /><span className="pointer-events-none absolute right-3 top-3 text-sm text-slate-500">%</span></div></Field>
                  <Field label="Repayment amount"><input inputMode="decimal" value={draft.repaymentAmount} onChange={(event) => update("repaymentAmount", event.target.value)} placeholder="$0" className={controlClass} /></Field>
                  <Field label="Repayment frequency"><select value={draft.repaymentFrequency} onChange={(event) => update("repaymentFrequency", event.target.value)} className={controlClass}><option>Weekly</option><option>Fortnightly</option><option>Monthly</option></select></Field>
                  <Field label="Repayment type"><select value={draft.repaymentType} onChange={(event) => update("repaymentType", event.target.value)} className={controlClass}><option>Principal and interest</option><option>Interest only</option></select></Field>
                  <Field label="Rate type"><select value={draft.rateType} onChange={(event) => update("rateType", event.target.value)} className={controlClass}><option>Variable</option><option>Fixed</option><option>Split</option></select></Field>
                  <Field label="Offset account balance"><input inputMode="decimal" value={draft.offsetBalance} onChange={(event) => update("offsetBalance", event.target.value)} placeholder="$0" className={controlClass} /></Field>
                </div> : null}
              </div>
            </div> : <div className="p-5 sm:p-6"><div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5"><h3 className="font-semibold text-slate-950">Continue in the owning Vireon workspace</h3><p className="mt-2 text-sm leading-6 text-slate-600">{selected.title} already has a canonical workspace. Continue there to add structured details, or use Document Vault for supporting evidence.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link href={owningWorkflows[category as Exclude<CategoryId, "property">].href} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">{owningWorkflows[category as Exclude<CategoryId, "property">].label}</Link><Link href="/financial-vault" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-700">Add supporting evidence</Link></div></div></div>}
            <div className="border-t border-slate-200 p-5 sm:p-6"><h3 className="font-semibold text-slate-950">{propertyFlow ? "3. Add supporting evidence" : "Supporting evidence"}</h3><div className="mt-4 flex min-h-[175px] flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-6 text-center"><UploadCloud className="h-7 w-7 text-blue-700" /><div className="mt-3 font-semibold text-slate-950">Add {propertyFlow ? "property and mortgage documents" : selected.title.toLowerCase()} from Document Vault</div><div className="mt-1 max-w-2xl text-sm text-slate-500">Select existing evidence here without leaving this workflow. A current mortgage statement helps verify the loan balance, interest rate, repayments and offset account.</div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void openVaultPicker()} aria-expanded={vaultOpen} aria-controls="document-vault-picker" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-700">Choose from Document Vault<ChevronDown className={"h-4 w-4 transition " + (vaultOpen ? "rotate-180" : "")} /></button><button type="button" onClick={() => setUploadOpen((current) => !current)} aria-expanded={uploadOpen} aria-controls="document-vault-upload" className="inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold text-blue-700">Upload new documents</button></div></div>
              {vaultOpen ? <div id="document-vault-picker" className="mt-3 rounded-xl border border-slate-200 bg-white p-4" aria-live="polite"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-slate-950">Current Document Vault</div><div className="mt-1 text-xs text-slate-500">Select every document that supports this property or mortgage.</div></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{draft.selectedDocuments.length} selected</span></div>
                {vaultLoading ? <div role="status" className="mt-4 text-sm text-slate-500">Loading your documents…</div> : vaultError ? <div role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{vaultError}<button type="button" onClick={() => void loadVaultDocuments()} className="ml-2 font-semibold underline">Try again</button></div> : vaultDocuments.length === 0 ? <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No documents are currently available. Upload a mortgage statement, bank statement or tax document to Document Vault, then return to this draft.</div> : <div className="mt-4 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">{vaultDocuments.map((document) => { const checked = draft.selectedDocuments.some((item) => item.id === document.id); return <label key={document.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50"><input type="checkbox" checked={checked} onChange={() => toggleDocument(document)} className="mt-1 h-4 w-4 accent-blue-700" /><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{document.fileName}</span><span className="mt-1 block text-xs text-slate-500">{documentTypeLabels[document.documentType]} · {new Date(document.uploadedAt).toLocaleDateString("en-AU")} · {documentStatusLabel(document.status)}</span></span>{document.documentType === "mortgage_statement" ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Recommended</span> : null}</label>; })}</div>}
              </div> : null}
              {uploadOpen ? <form id="document-vault-upload" onSubmit={(event) => void uploadDocument(event)} className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4"><div className="font-semibold text-slate-950">Upload supporting evidence</div><div className="mt-1 text-xs text-slate-500">The document will be stored in Document Vault and selected for this property.</div><div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr_auto]"><label><span className="mb-1.5 block text-xs font-semibold text-slate-600">Document type</span><select value={uploadType} onChange={(event) => setUploadType(event.target.value as VaultDocumentSummary["documentType"])} className={controlClass}>{Object.entries(documentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-semibold text-slate-600">File</span><input type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:font-semibold file:text-blue-700" /></label><button type="submit" disabled={!uploadFile || uploadBusy} className="min-h-11 self-end rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300">{uploadBusy ? "Uploading…" : "Upload & select"}</button></div>{uploadError ? <div role="alert" className="mt-3 text-sm text-rose-700">{uploadError}</div> : null}</form> : null}
              {draft.selectedDocuments.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{draft.selectedDocuments.map((document) => <span key={document.id} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"><FileCheck2 className="h-3.5 w-3.5" />{document.fileName}<button type="button" onClick={() => toggleDocument(document)} className="text-blue-600 hover:text-blue-900" aria-label={`Remove ${document.fileName}`}>×</button></span>)}</div> : null}
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4" />Documents remain securely stored in Document Vault and linked to their original source.</div></div>
          </section>
          <aside className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">What we’ll verify</h2><ul className="mt-4 space-y-3 text-sm text-slate-600">{["Ownership and address", "Current value", "Rental income, if applicable", "Related loan details"].map((item) => <li key={item} className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-blue-700" />{item}</li>)}</ul></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Your privacy</h2><p className="mt-3 flex gap-3 text-sm leading-6 text-slate-600"><ShieldCheck className="h-5 w-5 shrink-0" />Vireon only uses confirmed information in your financial position.</p></section></aside>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-6">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><House className="h-5 w-5" /></span><div><h2 className="font-semibold text-slate-950">{draft.address || "Property details"}</h2><div className="mt-1 text-xs text-slate-500">Source: {draft.addressSource === "geoscape-gnaf" ? "Geoscape Australia (G-NAF) address selection" : "manual entry"}; evidence remains managed by Document Vault</div></div><span className={"ml-auto rounded-full px-3 py-1 text-xs font-semibold " + (editingExisting && !hasPendingChanges ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>{editingExisting && !hasPendingChanges ? "Confirmed" : editingExisting ? "Changes not saved" : "Review before saving"}</span></div>
            <h3 className="mt-6 font-semibold text-slate-950">{editingExisting && !hasPendingChanges ? "Confirmed values" : editingExisting ? "Confirm changed values" : "Confirm entered values"}</h3>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-3 font-semibold">Information</th><th className="py-3 font-semibold">Entered value</th><th className="py-3 font-semibold">Confidence</th><th className="py-3 font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{reviewRows.map(([label, value, confidence]) => <tr key={label}><td className="py-3 font-medium text-slate-700">{label}</td><td className="py-3 text-slate-950">{value}</td><td className="py-3"><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (confidence === "High" ? "bg-emerald-50 text-emerald-700" : confidence === "Check" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{confidence}</span></td><td className="py-3"><button type="button" onClick={() => setStep(2)} className="font-semibold text-blue-700">{confidence === "Not found" ? "Add" : "Edit"}</button></td></tr>)}</tbody></table></div>
            <div className={"mt-5 rounded-xl border p-4 " + (editingExisting && !hasPendingChanges ? "border-emerald-200 bg-emerald-50/60" : "border-blue-200 bg-blue-50/60")}><div className={"font-semibold " + (editingExisting && !hasPendingChanges ? "text-emerald-950" : "text-blue-950")}>{editingExisting && !hasPendingChanges ? "These details are already saved and confirmed" : "Your confirmation saves these current details"}</div><div className={"mt-1 text-sm " + (editingExisting && !hasPendingChanges ? "text-emerald-900" : "text-blue-900")}>{editingExisting && !hasPendingChanges ? "No further review is required unless you change a property, mortgage or linked-document value." : "Values marked Check are saved as user-confirmed information. Linked documents remain in Document Vault for separate evidence review."}</div></div>
            <div className="mt-6"><h3 className="font-semibold text-slate-950">Supporting evidence</h3>{draft.selectedDocuments.length > 0 ? <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{draft.selectedDocuments.map((document) => <div key={document.id} className="flex items-center gap-3 p-4"><FileCheck2 className="h-5 w-5 shrink-0 text-blue-700" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-800">{document.fileName}</div><div className="mt-1 text-xs text-slate-500">{documentTypeLabels[document.documentType]} · {documentStatusLabel(document.status)}</div></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Verify in Import Review</span></div>)}</div> : <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No Document Vault evidence selected. Go back and attach a current statement before confirmation.</div>}</div>
          </section>
          <aside className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Source & provenance</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-xs text-slate-500">Address source</dt><dd className="mt-1 font-medium text-slate-800">{draft.addressSource === "geoscape-gnaf" ? "Geoscape Australia (G-NAF)" : "Manual entry"}</dd></div><div><dt className="text-xs text-slate-500">Evidence</dt><dd className="mt-1 font-medium text-slate-800">Document Vault</dd></div></dl><Link href="/financial-vault" className="mt-4 inline-flex text-sm font-semibold text-blue-700">View sources</Link></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">What happens next?</h2><div className="mt-4 space-y-4 text-sm leading-6 text-slate-600"><p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />Your confirmed property and mortgage appear immediately in Financial Position.</p><p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />Import Review separately verifies values extracted from supporting documents.</p></div></section></aside>
        </div>
      )}

      <footer className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
        {step === 1 ? <Link href="/financial-profile" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" />Back to Financial Position</Link> : <button type="button" onClick={() => setStep(step === 2 ? 1 : 2)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" />{step === 2 ? "Back" : "Back to details"}</button>}
        <div className="flex-1" />
        {saved ? <span role="status" className="text-sm font-semibold text-emerald-700">Draft saved in this browser. It is not yet part of Financial Position.</span> : null}
        {submitError ? <span role="alert" className="max-w-md text-sm font-semibold text-rose-700">{submitError}</span> : null}
        <button type="button" onClick={saveDraft} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50">Save draft in this browser</button>
        {step === 1 ? <button type="button" onClick={() => setStep(2)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Continue<ArrowRight className="h-4 w-4" /></button> : step === 2 ? propertyFlow ? <button type="button" onClick={() => setStep(3)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">{propertyPresentation.primaryAction}<ArrowRight className="h-4 w-4" /></button> : <Link href={owningWorkflows[category as Exclude<CategoryId, "property">].href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">{owningWorkflows[category as Exclude<CategoryId, "property">].label}<ArrowRight className="h-4 w-4" /></Link> : propertyState === "confirmed" ? <Link href="/financial-profile" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Back to Financial Position<ArrowRight className="h-4 w-4" /></Link> : <button type="button" onClick={() => void confirmProperty()} disabled={submitBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400">{submitBusy ? "Saving…" : editingExisting ? "Confirm & update Financial Position" : "Confirm & save to Financial Position"}<ArrowRight className="h-4 w-4" /></button>}
      </footer>
    </div>
  );
}

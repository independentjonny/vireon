import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  FileCheck2,
  Home,
  Landmark,
  MapPin,
  Percent,
  RefreshCw,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import type { UploadedDocument } from "@/lib/financialVaultTypes";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

function text(value: unknown, fallback = "Not provided") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%\s,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function money(value: unknown) {
  const amount = number(value);
  return amount === null
    ? "Not provided"
    : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(amount);
}

function date(value: unknown) {
  if (typeof value !== "string" || !value) return "Not provided";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

function documentIds(record: CanonicalFinancialRecord) {
  return Array.isArray(record.value.sourceDocumentIds)
    ? record.value.sourceDocumentIds.filter((value): value is string => typeof value === "string")
    : [];
}

function documentsFor(records: CanonicalFinancialRecord[], documents: UploadedDocument[]) {
  const ids = new Set(records.flatMap(documentIds));
  return documents.filter((document) => ids.has(document.id));
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Home }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</div>
      </div>
    </div>
  );
}

export default async function PropertyDetailsPage() {
  const session = await requireServerPageSession("/financial-profile/property");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);
  const properties = position.propertyDetails;

  return (
    <AppShell active="financial-position">
      <div className="mx-auto w-full max-w-[1180px] space-y-6 pb-12">
        <header>
          <Link href="/financial-profile" className="inline-flex min-h-10 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            <ArrowLeft className="h-4 w-4" /> Back to Financial Position
          </Link>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Financial profile</div>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Your property details</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Current property, mortgage and supporting evidence saved in your financial profile.</p>
            </div>
            <Link href="/financial-profile/add-data?category=property" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800">
              <RefreshCw className="h-4 w-4" /> Update property details
            </Link>
          </div>
        </header>

        {properties.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Building2 className="h-6 w-6" /></div>
            <h2 className="mt-4 text-xl font-semibold text-slate-950">No property details are confirmed yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Add the property you own, any current mortgage, and supporting documents to include them in your financial position.</p>
            <Link href="/financial-profile/add-data?category=property" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Add property details <ArrowRight className="h-4 w-4" /></Link>
          </section>
        ) : (
          <div className="space-y-6">
            {properties.map((property, index) => {
              const propertyKey = text(property.value.entityKey, "");
              const mortgages = position.mortgageDetails.filter((mortgage) => mortgage.value.propertyEntityKey === propertyKey);
              const linkedRecords = [property, ...mortgages];
              const linkedDocuments = documentsFor(linkedRecords, position.documentImportStatus.documents);
              const address = text(property.value.address, property.label);

              return (
                <article key={property.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Property {properties.length > 1 ? index + 1 : ""}</div>
                        <h2 className="mt-1 break-words text-xl font-semibold text-slate-950">{address}</h2>
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Confirmed current information</div>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated value</div>
                      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{money(property.value.marketValue)}</div>
                    </div>
                  </div>

                  <section className="p-5 sm:p-6" aria-labelledby={`property-${property.id}`}>
                    <h3 id={`property-${property.id}`} className="text-base font-semibold text-slate-950">Property information</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Detail label="Address" value={address} icon={MapPin} />
                      <Detail label="Property type" value={text(property.value.propertyType)} icon={Home} />
                      <Detail label="Ownership" value={text(property.value.ownership)} icon={Users} />
                      <Detail label="Primary use" value={text(property.value.primaryUse)} icon={Building2} />
                      <Detail label="Purchase date" value={date(property.value.purchaseDate)} icon={CalendarDays} />
                      <Detail label="Rental income" value={property.value.rentalIncome ? money(property.value.rentalIncome) : "No rental income recorded"} icon={Banknote} />
                    </div>
                  </section>

                  <section id="mortgage" className="scroll-mt-6 border-t border-slate-200 p-5 sm:p-6" aria-labelledby={`mortgage-${property.id}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 id={`mortgage-${property.id}`} className="text-base font-semibold text-slate-950">Mortgage or home loan</h3>
                      <div className="text-xs font-semibold text-slate-500">{mortgages.length} linked loan{mortgages.length === 1 ? "" : "s"}</div>
                    </div>
                    {mortgages.length ? mortgages.map((mortgage) => (
                      <div key={mortgage.id} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Lender" value={text(mortgage.value.lender)} icon={Landmark} />
                        <Detail label="Outstanding balance" value={money(mortgage.value.balance)} icon={WalletCards} />
                        <Detail label="Interest rate" value={number(mortgage.value.interestRate) === null ? "Not provided" : `${number(mortgage.value.interestRate)}%`} icon={Percent} />
                        <Detail label="Repayment" value={number(mortgage.value.repaymentAmount) === null ? "Not provided" : `${money(mortgage.value.repaymentAmount)} ${text(mortgage.value.repaymentFrequency, "").toLowerCase()}`} icon={Banknote} />
                        <Detail label="Repayment type" value={text(mortgage.value.repaymentType)} icon={RefreshCw} />
                        <Detail label="Rate type" value={text(mortgage.value.rateType)} icon={Percent} />
                        <Detail label="Offset balance" value={money(mortgage.value.offsetBalance)} icon={WalletCards} />
                      </div>
                    )) : (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No mortgage is linked to this property.</div>
                    )}
                  </section>

                  <section className="border-t border-slate-200 p-5 sm:p-6" aria-labelledby={`evidence-${property.id}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 id={`evidence-${property.id}`} className="text-base font-semibold text-slate-950">Supporting evidence</h3>
                        <p className="mt-1 text-sm text-slate-500">Documents stay in Document Vault and remain linked to this property record.</p>
                      </div>
                      <Link href="/financial-vault" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">Open Document Vault <ArrowRight className="h-4 w-4" /></Link>
                    </div>
                    {linkedDocuments.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {linkedDocuments.map((document) => (
                          <div key={document.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"><FileCheck2 className="h-4 w-4" /></div>
                            <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-900">{document.fileName}</div><div className="mt-0.5 text-xs capitalize text-slate-500">{document.documentType.replaceAll("_", " ")} · {document.status.replaceAll("_", " ")}</div></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No supporting documents are linked yet. You can add or choose existing evidence when updating this property.</div>
                    )}
                  </section>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

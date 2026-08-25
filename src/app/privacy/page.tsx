import { FileText, LockKeyhole, MessageSquareWarning, ShieldCheck, Trash2 } from "lucide-react";
import AppShell from "../components/AppShell";
import { PrivateBetaFoundation } from "@/lib/privateBetaFoundation";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const readiness = PrivateBetaFoundation.buildPrivateBetaReadinessReport(PrivateBetaFoundation.configFromEnv());
  const sections = [
    {
      title: "What Vireon stores",
      body: "Vireon stores financial profile records, confirmed imports, scenario and goal assumptions, deterministic calculation snapshots, provenance, freshness and safe audit metadata.",
    },
    {
      title: "Why it is collected",
      body: "The data is used to calculate financial health, forecasts, goals, timeline events and deterministic briefings. Results depend on what you provide and confirm.",
    },
    {
      title: "Confirmed and estimated data",
      body: "Confirmed records are used as calculation inputs. Estimated or assumption-driven values are labelled and can lower result quality.",
    },
    {
      title: "Uploaded documents",
      body: "Uploads require explicit consent, are validated by type and size, and must not be placed in public application paths. Private beta exports include metadata, not raw document contents.",
    },
    {
      title: "AI and Open Banking",
      body: `Open Banking is ${readiness.openBankingState}. Live AI is ${readiness.liveAiState}. User financial data is not sent to external AI providers in this deterministic beta foundation.`,
    },
    {
      title: "Export and deletion",
      body: "You can export your Vireon data or permanently delete only your financial data. A financial-data reset keeps your Vireon account, personal details, authentication, access, onboarding, preferences, feedback and security audit history.",
    },
  ];

  return (
    <AppShell active="settings">
      <main className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Private beta privacy
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">Privacy controls</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vireon is a beta product. Financial results may be incomplete, projections are estimates, and borrowing figures are indicative only. Professional advice may be required before acting.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <LockKeyhole className="h-4 w-4 text-blue-600" />
                {section.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <a href="/api/private-beta/export" className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" />
            Export status
          </a>
          <a href="/beta-onboarding" className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <MessageSquareWarning className="h-4 w-4" />
            Report an issue
          </a>
          <a href="/beta-onboarding#financial-data-controls" className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            <Trash2 className="h-4 w-4" />
            Delete financial data
          </a>
        </section>
      </main>
    </AppShell>
  );
}

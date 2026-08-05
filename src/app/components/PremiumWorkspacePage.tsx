import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, FileText, Sparkles } from "lucide-react";

type WorkspaceMetric = {
  label: string;
  value: string;
  note: string;
};

type WorkspaceAction = {
  label: string;
  href: string;
};

export default function PremiumWorkspacePage({
  eyebrow,
  title,
  subtitle,
  metrics,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics: WorkspaceMetric[];
  actions: WorkspaceAction[];
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[10px] border border-slate-200 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Sparkles className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
              {eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link key={action.href} href={action.href} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#10243b] px-4 text-sm font-semibold text-white">
                {action.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {metrics.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
              <div className="text-xs font-semibold uppercase text-slate-500">{metric.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{metric.note}</div>
            </article>
          ))}
        </section>
      ) : null}

      {children ?? (
        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <h2 className="text-lg font-semibold text-slate-950">Decision workspace</h2>
            <div className="mt-5 space-y-3">
              {[
                "What changed since last month",
                "What requires attention",
                "What action improves the profile",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-lg border border-blue-100 bg-blue-50 p-6">
            <div className="flex items-center gap-3 text-sm font-semibold text-blue-900">
              <Bot className="h-5 w-5" />
              Vireon recommendation
            </div>
            <p className="mt-4 text-sm leading-6 text-blue-900">
              This workspace is connected to the Financial Vault model and ready for GPT enhancement when enabled.
            </p>
            <div className="mt-5 rounded-lg bg-white p-4 text-sm text-slate-700">
              <FileText className="mb-2 h-4 w-4 text-blue-600" />
              Documents, accounts, recommendations, and timeline events will consolidate here.
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

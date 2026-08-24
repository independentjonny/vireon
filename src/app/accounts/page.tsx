import AppShell from "../components/AppShell";
import TransactionsSection from "../components/sections/TransactionsSection";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
function recordValue(value: Record<string, unknown>) {
  for (const key of ["balance", "amount", "value", "marketValue"]) {
    const raw = value[key];
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[$,\s]/g, "")) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export default async function AccountsPage() {
  const session = await requireServerPageSession("/accounts");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);
  const propertyIds = new Set(position.propertyDetails.map((item) => item.id));
  const superIds = new Set(position.superannuation.map((item) => item.id));
  const accounts = position.assets.filter((item) => !propertyIds.has(item.id) && !superIds.has(item.id) && !/share|investment|etf/i.test(`${item.label} ${item.subtype}`));
  const total = accounts.reduce((sum, item) => sum + recordValue(item.value), 0);
  return <AppShell active="workspace"><main className="mx-auto max-w-[1380px] space-y-4 pb-12"><header><div className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-700">Daily money</div><h1 className="mt-1 text-3xl font-medium text-[#10243b]">Bank Accounts</h1><p className="mt-1 text-sm text-slate-600">Balances, source accounts and transactions in one place.</p></header><section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Available cash</div><div className="mt-1 text-2xl font-medium text-[#10243b]">{money(total)}</div></div><a href="/financial-profile/add-data?category=bank" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-blue-700">Manage accounts</a></div><div className="mt-4 divide-y divide-slate-200">{accounts.map((account) => <div key={account.id} className="flex items-center gap-4 py-3"><div className="flex-1"><div className="font-medium text-[#10243b]">{account.label}</div><div className="mt-0.5 text-xs text-slate-500">{account.subtype.replaceAll("-", " ")} · confirmed source</div></div><strong className="font-medium text-[#10243b]">{money(recordValue(account.value))}</strong></div>)}{!accounts.length && <div className="py-4 text-sm text-slate-600">No confirmed bank accounts yet.</div>}</div></section><TransactionsSection /></main></AppShell>;
}

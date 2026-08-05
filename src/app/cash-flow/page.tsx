import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";

const incomeBreakdown = [
  {
    category: "Salary",
    amount: 14200,
    share: 97,
    source: "Payroll deposits",
    cadence: "Fortnightly",
    confidence: "High",
  },
  {
    category: "Interest",
    amount: 180,
    share: 1,
    source: "Savings account interest",
    cadence: "Monthly",
    confidence: "Medium",
  },
  {
    category: "Reimbursements",
    amount: 300,
    share: 2,
    source: "Employer reimbursements",
    cadence: "One-off",
    confidence: "Medium",
  },
];

const incomeSources = [
  { date: "Jun 7", description: "Salary Deposit", account: "Everyday Account", amount: 7340, source: "Bank Statement" },
  { date: "Jun 21", description: "Salary Deposit", account: "Everyday Account", amount: 6860, source: "Bank Statement" },
  { date: "Jun 28", description: "Interest Credit", account: "High Interest Saver", amount: 180, source: "Bank Statement" },
  { date: "Jun 30", description: "Expense Reimbursement", account: "Everyday Account", amount: 300, source: "Transactions" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CashFlowPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Cash Flow Workspace"
        title="Cash Flow"
        subtitle="Understand income, expenses, surplus, recurring leakage, and borrowing-capacity impact."
        metrics={[
          { label: "Monthly Surplus", value: "$6,420", note: "$1,230 better than last month" },
          { label: "Income", value: "$14,680", note: "This month - salary and recurring deposits" },
          { label: "Expenses", value: "$8,260", note: "This month - core and discretionary spending" },
          { label: "Emergency Fund", value: "4.2 mo", note: "Cash runway at current spend" },
        ]}
        actions={[{ label: "Find Savings", href: "/insights" }]}
      >
        <section className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Income Breakdown</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Period: 1 Jun - 30 Jun 2026</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
                <div className="text-xs font-semibold uppercase text-emerald-700">Total income</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{money(14680)}</div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {incomeBreakdown.map((item) => (
                <div key={item.category} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{item.category}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.source} - {item.cadence} - {item.confidence} confidence
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-slate-950">{money(item.amount)}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${item.share}%` }} />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-500">{item.share}% of monthly income</div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <h2 className="text-lg font-semibold text-slate-950">Income Sources</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Source transactions used to support this month&apos;s income total.</p>
            <div className="mt-5 divide-y divide-slate-100">
              {incomeSources.map((source) => (
                <div key={`${source.date}-${source.description}-${source.amount}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{source.description}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {source.date} - {source.account} - Source: {source.source}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-emerald-600">+{money(source.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
            <a href="/transactions" className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
              Review income transactions
            </a>
          </article>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <h2 className="text-lg font-semibold text-slate-950">Decision workspace</h2>
            <div className="mt-5 space-y-3">
              {["What changed since last month", "What requires attention", "What action improves the profile"].map((item) => (
                <div key={item} className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-lg border border-blue-100 bg-blue-50 p-6">
            <div className="text-sm font-semibold text-blue-900">Vireon recommendation</div>
            <p className="mt-4 text-sm leading-6 text-blue-900">
              Income is mostly salary-backed this month, which improves confidence for borrowing-capacity and lender-pack outputs. Keep payslips current in Financial Vault.
            </p>
          </article>
        </section>
      </PremiumWorkspacePage>
    </AppShell>
  );
}

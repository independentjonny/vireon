import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";

export default function BudgetsPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Budget Planning"
        title="Budgets"
        subtitle="Budget planning is not available in this Preview. Review your recorded income and expenses in Cash Flow."
        metrics={[]}
        actions={[{ label: "Review Transactions", href: "/transactions" }]}
      >
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Budget analysis unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">Category trends, budget targets and savings opportunities have not been calculated for your account.</p>
          <a className="mt-4 inline-block font-semibold text-blue-700 underline" href="/cash-flow">Review cash flow</a>
        </section>
      </PremiumWorkspacePage>
    </AppShell>
  );
}

import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";

export default function BudgetsPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Budget Planning"
        title="Budgets"
        subtitle="Track spending pressure, category drift, and savings opportunities."
        metrics={[
          { label: "Dining", value: "+18%", note: "Above recent average" },
          { label: "Savings Gap", value: "$400", note: "Improves housing readiness" },
          { label: "Subscriptions", value: "$268", note: "Review recommended" },
          { label: "Budget Status", value: "Watch", note: "Two categories elevated" },
        ]}
        actions={[{ label: "Review Transactions", href: "/transactions" }]}
      />
    </AppShell>
  );
}

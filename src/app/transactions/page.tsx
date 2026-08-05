import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";
import TransactionsSection from "../components/sections/TransactionsSection";

export default function TransactionsPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Transaction Intelligence"
        title="Transactions"
        subtitle="Search, review, and classify transaction activity with category intelligence and cash-flow context."
        metrics={[]}
        actions={[{ label: "Review Recurring", href: "/#subscriptions" }]}
      >
        <TransactionsSection />
      </PremiumWorkspacePage>
    </AppShell>
  );
}

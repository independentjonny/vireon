import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";
import SubscriptionsSection from "../components/sections/SubscriptionsSection";

export default function SubscriptionsPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Recurring Payments"
        title="Subscriptions"
        subtitle="Review recurring merchants, renewal timing, cancellation opportunities, and savings actions."
        metrics={[]}
        actions={[{ label: "Review transactions", href: "/transactions" }]}
      >
        <SubscriptionsSection />
      </PremiumWorkspacePage>
    </AppShell>
  );
}

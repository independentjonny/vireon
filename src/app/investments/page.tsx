import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";

export default function InvestmentsPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Investment Workspace"
        title="Investments"
        subtitle="Performance, allocation, returns, concentration risk, and recommendations."
        metrics={[
          { label: "Portfolio", value: "$480k", note: "+$1,120 today" },
          { label: "12m Return", value: "+8.4%", note: "Weighted demo return" },
          { label: "Concentration", value: "High", note: "Property remains dominant" },
          { label: "Next Action", value: "Diversify", note: "Review new contributions" },
        ]}
        actions={[{ label: "Open Investment Detail", href: "/balance-sheet/investments" }]}
      />
    </AppShell>
  );
}

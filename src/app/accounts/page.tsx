import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";

export default function AccountsPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Accounts Workspace"
        title="Accounts"
        subtitle="Expandable account groups for cash, investments, property, super, credit cards, and loans."
        metrics={[
          { label: "Connected Groups", value: "6", note: "Cash, Investments, Property, Super, Cards, Loans" },
          { label: "Profile Confidence", value: "93%", note: "Sourced from Financial Vault and manual entries" },
          { label: "Documents Linked", value: "8", note: "Statements and supporting evidence" },
          { label: "Open Actions", value: "3", note: "Review cards, refinance, update payslip" },
        ]}
        actions={[{ label: "Open Balance Sheet", href: "/balance-sheet" }]}
      />
    </AppShell>
  );
}

import AppShell from "../components/AppShell";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";

export default function ReportsPage() {
  return (
    <AppShell active="workspace">
      <PremiumWorkspacePage
        eyebrow="Reporting Workspace"
        title="Reports"
        subtitle="Generate lender packs, financial summaries, tax-ready exports, and planning reports."
        metrics={[
          { label: "Lender Pack", value: "Ready", note: "4 of 5 required document types" },
          { label: "Vault Confidence", value: "93%", note: "Source-traced values" },
          { label: "Missing Docs", value: "1", note: "Latest payslip recommended" },
          { label: "Exports", value: "HTML/JSON", note: "PDF staged later" },
        ]}
        actions={[{ label: "Open Financial Vault", href: "/financial-vault" }]}
      />
    </AppShell>
  );
}

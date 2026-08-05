import AppShell from "../components/AppShell";
import FinancialVaultClient from "../components/FinancialVaultClient";

export const dynamic = "force-dynamic";

export default function FinancialVaultPage() {
  return (
    <AppShell active="financial-vault">
      <FinancialVaultClient initialVault={null} />
    </AppShell>
  );
}

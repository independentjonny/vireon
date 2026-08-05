import AppShell from "../components/AppShell";
import DeveloperModeSettings from "../components/DeveloperModeSettings";
import PremiumWorkspacePage from "../components/PremiumWorkspacePage";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <PremiumWorkspacePage
        eyebrow="Settings"
        title="Settings"
        subtitle="Configure Vireon, privacy, local-first storage, and Developer Mode. Developer Mode can also be toggled with Ctrl+Shift+D."
        metrics={[
          { label: "Storage", value: "Local", note: "Documents stay on this machine" },
          { label: "GPT", value: "Optional", note: "Enabled when API key is configured" },
          { label: "Developer Mode", value: "Hidden", note: "Toggle in sidebar or shortcut" },
          { label: "Privacy", value: "Local-first", note: "No external document processing" },
        ]}
        actions={[{ label: "Review Vault", href: "/financial-vault" }]}
      >
        <DeveloperModeSettings />
      </PremiumWorkspacePage>
    </AppShell>
  );
}

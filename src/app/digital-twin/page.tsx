import AppShell from "../components/AppShell";
import DigitalTwinClient from "../components/DigitalTwinClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function DigitalTwinPage() {
  const session = await requireServerPageSession();
  const state = await createCoreDecisioningServiceFromEnv().readDigitalTwin(session);

  return (
    <AppShell active="digital-twin">
      <DigitalTwinClient initialState={state} />
    </AppShell>
  );
}

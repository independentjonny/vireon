import AppShell from "../components/AppShell";
import PrivateBetaFoundationClient from "../components/PrivateBetaFoundationClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { buildPrivateBetaContext, toBetaSession } from "@/lib/privateBetaRuntime";
import { createPrivateBetaOnboardingServiceFromEnv } from "@/server/services/privateBetaOnboardingPostgresService";

export const dynamic = "force-dynamic";

export default async function BetaOnboardingPage() {
  const authenticatedSession = await requireServerPageSession("/beta-onboarding");
  const session = toBetaSession(authenticatedSession);
  const context = await buildPrivateBetaContext(session);
  const onboarding = await createPrivateBetaOnboardingServiceFromEnv().readOrCreate(authenticatedSession);

  return (
    <AppShell active="workspace">
      <PrivateBetaFoundationClient
        initialOnboarding={onboarding}
        readiness={context.readiness}
        briefing={context.briefing}
        health={context.health}
        forecast={context.forecast}
        goals={context.goals}
        provenance={context.provenance}
      />
    </AppShell>
  );
}

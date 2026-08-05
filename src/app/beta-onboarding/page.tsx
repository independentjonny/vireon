import AppShell from "../components/AppShell";
import PrivateBetaFoundationClient from "../components/PrivateBetaFoundationClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { PrivateBetaFoundation } from "@/lib/privateBetaFoundation";
import { buildPrivateBetaContext, toBetaSession } from "@/lib/privateBetaRuntime";

export const dynamic = "force-dynamic";

export default async function BetaOnboardingPage() {
  const session = toBetaSession(await requireServerPageSession("/beta-onboarding"));
  const context = await buildPrivateBetaContext(session);
  const onboarding = PrivateBetaFoundation.mutateState((draft) => {
    let current = draft.onboarding.find((item) => item.userId === session.userId && item.householdId === session.householdId);
    if (!current && session.userId && session.householdId) {
      current = PrivateBetaFoundation.defaultOnboardingState(session.userId, session.householdId);
      draft.onboarding.push(current);
    }
    return current;
  });

  if (!onboarding) {
    return (
      <AppShell active="workspace">
        <main className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">Private beta session unavailable.</main>
      </AppShell>
    );
  }

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

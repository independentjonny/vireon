import Link from "next/link";
import AppShell from "../../components/AppShell";
import RedeemInvitationForm from "./RedeemInvitationForm";

export const dynamic = "force-dynamic";

export default async function RedeemInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AppShell active="dashboard">
      <main className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="text-xs font-semibold uppercase text-blue-700">Invite-only beta</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Redeem your invitation</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Create your Vireon account with the email address approved for your invitation. New accounts start in beta onboarding before product workspaces open.
        </p>
        <RedeemInvitationForm token={token} />
        <Link className="mt-5 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900" href="/login">
          Back to sign in
        </Link>
      </main>
    </AppShell>
  );
}

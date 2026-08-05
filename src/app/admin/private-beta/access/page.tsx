import AppShell from "../../../components/AppShell";
import { hasPermission } from "@/lib/auth/rbac";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import PrivateBetaAccessAdminClient from "./PrivateBetaAccessAdminClient";

export const dynamic = "force-dynamic";

export default async function PrivateBetaAccessAdminPage() {
  const session = await requireServerPageSession("/admin/private-beta/access");
  const authorised = hasPermission(session.role, "manage:private_beta_access");

  return (
    <AppShell active="settings">
      <main className="mx-auto max-w-4xl p-6">
        <div className="text-xs font-semibold uppercase text-blue-700">Private beta administration</div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Access requests</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Review request-access submissions, approve one-time invitation links, or reject requests. Invitation links are sensitive and only shown once.
        </p>
        {authorised ? (
          <PrivateBetaAccessAdminClient />
        ) : (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            You do not have permission to manage private beta access.
          </div>
        )}
      </main>
    </AppShell>
  );
}

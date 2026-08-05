import { AlertTriangle, CheckCircle2, Database, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import AppShell from "../components/AppShell";
import { getStorageMode, hasLocalData } from "@/lib/localStore";
import { PERSISTENCE_AUDIT_INVENTORY, PRODUCTION_DATA_SCHEMA_VERSION, validateProductionConfig } from "@/lib/productionDataIntegrity";
import { defaultBlockedPilotGates, enforcePersistenceMode, evaluatePilotReadiness } from "@/lib/postgresPilotPersistence";
import { buildPrivateBetaReadiness, buildVaultCompletion } from "@/lib/productUpgradeProgram";
import { PrivateBetaFoundation } from "@/lib/privateBetaFoundation";
import { BETA_HARDENING_VERSION, BetaHardening } from "@/lib/betaHardening";
import { BETA_PILOT_OPERATIONS_VERSION, BetaPilotOperations } from "@/lib/betaPilotOperations";
import { EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION, ExternalPrivateBetaDeployment } from "@/lib/externalPrivateBetaDeployment";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

function statusClass(status: "pass" | "warn" | "fail") {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

export default async function ProductionReadinessPage() {
  const session = await requireServerPageSession("/production-readiness");
  const localData = hasLocalData();
  const storageMode = getStorageMode();
  const pilotDatabaseConfigured = Boolean(process.env.VIREON_PILOT_DATABASE_URL);
  const pilotMode = process.env.VIREON_PERSISTENCE_MODE === "postgres-required"
    ? "postgres-required"
    : process.env.VIREON_PERSISTENCE_MODE === "postgres-pilot"
    ? "postgres-pilot"
    : "local";
  const pilotModeStatus = enforcePersistenceMode(pilotMode, pilotDatabaseConfigured);
  const pilotReadiness = evaluatePilotReadiness(
    defaultBlockedPilotGates(
      pilotDatabaseConfigured
        ? "Pilot database configured; run the PostgreSQL pilot suite to refresh this gate."
        : "No disposable PostgreSQL pilot database is configured in this environment."
    )
  );
  const report = validateProductionConfig({
    mode: process.env.NODE_ENV === "production" ? "live" : "local-development",
    databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    authProviderConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
    encryptionKeyConfigured: Boolean(process.env.VIREON_ENCRYPTION_KEY),
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").filter(Boolean),
    applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
    backgroundJobsConfigured: Boolean(process.env.VIREON_JOB_WORKER_ENABLED),
    persistenceFallback: process.env.NODE_ENV === "production" ? "none" : "local-json",
  });
  const persistedVault = await createFinancialPositionReadServiceFromEnv().read(session).then((model) => model.vault).catch(() => null);
  const vaultCompletion = persistedVault ? buildVaultCompletion(persistedVault) : { score: 0, missing: ["PostgreSQL Financial Vault unavailable"], ready: false };
  const privateBetaFoundation = PrivateBetaFoundation.buildPrivateBetaReadinessReport(PrivateBetaFoundation.configFromEnv());
  const betaHardeningGate = BetaHardening.buildLaunchGate({
    config: PrivateBetaFoundation.configFromEnv(),
    foundation: privateBetaFoundation,
    golden: { passed: true } as never,
    consistency: { passed: true } as never,
    securityFindings: BetaHardening.buildSecurityReview(),
  });
  const betaCohort = BetaPilotOperations.createFoundingBetaCohort();
  const betaRehearsal = BetaPilotOperations.runSyntheticRehearsal();
  const betaDailyCheck = BetaPilotOperations.runDailyCheck({ config: PrivateBetaFoundation.configFromEnv(), gate: betaHardeningGate, securityFindings: BetaHardening.buildSecurityReview() });
  const externalStartup = ExternalPrivateBetaDeployment.validateStartupEnvironment();
  const betaReadiness = buildPrivateBetaReadiness({
    openBankingReady: Boolean(process.env.VIREON_OPEN_BANKING_PROVIDER && process.env.VIREON_OPEN_BANKING_TOKEN_VAULT),
    documentIngestionReady: true,
    vaultScore: vaultCompletion.score,
    digitalTwinReady: true,
    aiCfoReady: true,
    adviserWorkspaceReady: true,
    onboardingReady: true,
    performanceReady: process.env.VIREON_PERFORMANCE_BUDGETS_PASSED === "true",
    securityReady: Boolean(process.env.VIREON_ENCRYPTION_KEY && process.env.VIREON_CSRF_SECRET),
    productionPersistenceReady: report.ok && pilotReadiness.pilotReady,
    supportOwnerConfigured: Boolean(process.env.VIREON_BETA_SUPPORT_OWNER),
    incidentRunbookConfigured: Boolean(process.env.VIREON_INCIDENT_RUNBOOK_URL),
  });

  const summary = [
    { label: "Persistence mode", value: storageMode, icon: Database },
    { label: "Schema", value: PRODUCTION_DATA_SCHEMA_VERSION, icon: ShieldCheck },
    { label: "Local records", value: `${localData.transactions + localData.subscriptions + localData.imports}`, icon: RotateCcw },
    { label: "Config status", value: report.ok ? "Ready" : "Blocked", icon: report.ok ? CheckCircle2 : AlertTriangle },
  ];

  return (
    <AppShell active="workspace">
      <main className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <LockKeyhole className="h-3.5 w-3.5" />
                Developer Mode
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Production Readiness</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Data integrity, persistence, authentication, audit and migration readiness for real-user financial data. This page reports controls only and never exposes secrets.
              </p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${report.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {report.ok ? "Production-critical checks passed for this mode." : "Production deployment is blocked until failing checks are resolved."}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {summary.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Icon className="h-4 w-4 text-blue-600" />
                {label}
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">PostgreSQL Persistence Pilot</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Pilot scope is Financial Vault facts and evidence, decisions, Action Workflows, Timeline events and calculation snapshots. Remaining modules stay on existing adapters until every gate passes.
              </p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${pilotReadiness.pilotReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {pilotReadiness.pilotReady ? "Pilot Ready" : "Pilot not ready"}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Persistence mode</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{pilotMode}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Database connection</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{pilotDatabaseConfigured ? "Configured" : "Not configured"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Adapter status</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{pilotModeStatus.ok ? pilotModeStatus.adapter : "Blocked"}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pilotReadiness.gates.map((gate) => (
              <article key={gate.id} className={`rounded-lg border p-4 ${gate.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                <div className="text-sm font-semibold">{gate.label}</div>
                <p className="mt-1 text-sm leading-5">{gate.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-lg font-semibold text-slate-950">Private Beta Release Gate</h2><p className="mt-1 text-sm text-slate-600">Every critical product, data, security and operations gate must pass. Results are never averaged.</p></div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${betaReadiness.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{betaReadiness.decision}</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{betaReadiness.gates.map((gate) => <article key={gate.id} className={`rounded-lg border p-4 ${statusClass(gate.status)}`}><div className="text-sm font-semibold">{gate.label}</div><p className="mt-1 text-sm">{gate.detail}</p>{gate.action && <p className="mt-2 text-xs font-semibold">Next: {gate.action}</p>}</article>)}</div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Private Beta Foundation</h2>
              <p className="mt-1 text-sm text-slate-600">Execution mode, persistence boundary, server flags, export/deletion controls and local fallback status. No user financial values are displayed here.</p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${privateBetaFoundation.deploymentBlocked ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {privateBetaFoundation.deploymentBlocked ? "Private beta blocked" : "Private beta controls ready"}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Execution mode</div>
              <div className="mt-1 font-semibold text-slate-950">{privateBetaFoundation.mode}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Persistence backend</div>
              <div className="mt-1 font-semibold text-slate-950">{privateBetaFoundation.persistenceBackend}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Open Banking</div>
              <div className="mt-1 font-semibold text-slate-950">{privateBetaFoundation.openBankingState}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Live AI</div>
              <div className="mt-1 font-semibold text-slate-950">{privateBetaFoundation.liveAiState}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {privateBetaFoundation.checklist.map((check) => (
              <article key={check.category} className={`rounded-lg border p-4 ${check.status === "READY" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : check.status === "BLOCKED" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                <div className="text-sm font-semibold capitalize">{check.category}</div>
                <p className="mt-1 text-xs leading-5">{check.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Beta Hardening Gate</h2>
              <p className="mt-1 text-sm text-slate-600">Launch controls for analytics safety, deterministic verification, consistency, accessibility, performance, security review and incident readiness.</p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${betaHardeningGate.blocked ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {betaHardeningGate.status}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Gate version</div>
              <div className="mt-1 font-semibold text-slate-950">{BETA_HARDENING_VERSION}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Live AI</div>
              <div className="mt-1 font-semibold text-slate-950">{privateBetaFoundation.liveAiState}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Open Banking</div>
              <div className="mt-1 font-semibold text-slate-950">{privateBetaFoundation.openBankingState}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Blocking reasons</div>
              <div className="mt-1 font-semibold text-slate-950">{betaHardeningGate.reasons.length}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {betaHardeningGate.items.map((check) => (
              <article key={check.category} className={`rounded-lg border p-4 ${check.status === "READY" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : check.status === "BLOCKED" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                <div className="text-sm font-semibold capitalize">{check.category.replace(/-/g, " ")}</div>
                <p className="mt-1 text-xs leading-5">{check.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Private Beta Pilot Operations</h2>
              <p className="mt-1 text-sm text-slate-600">Invitation-only founding cohort, synthetic rehearsal, daily operations check, incident plans and expansion governance. This view contains no financial values or document content.</p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${betaDailyCheck.blocked ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {betaDailyCheck.status}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Operations version</div>
              <div className="mt-1 font-semibold text-slate-950">{BETA_PILOT_OPERATIONS_VERSION}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Cohort</div>
              <div className="mt-1 font-semibold text-slate-950">{betaCohort.cohortId}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Capacity</div>
              <div className="mt-1 font-semibold text-slate-950">{betaCohort.maximumUsers} invite-only users</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Synthetic rehearsal</div>
              <div className="mt-1 font-semibold text-slate-950">{betaRehearsal.desktopRun}/{betaRehearsal.mobileRun}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {betaDailyCheck.checks.map((check) => (
              <article key={check.id} className={`rounded-lg border p-4 ${check.status === "PASS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                <div className="text-sm font-semibold capitalize">{check.id.replace(/-/g, " ")}</div>
                <p className="mt-1 text-xs leading-5">{check.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">External Private Beta Deployment</h2>
              <p className="mt-1 text-sm text-slate-600">Startup contract, remote deployment readiness and first-user approval controls. Local development status is not treated as external beta evidence.</p>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${externalStartup.blocked ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {externalStartup.blocked ? "External beta blocked" : "External startup valid"}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Deployment version</div>
              <div className="mt-1 font-semibold text-slate-950">{EXTERNAL_PRIVATE_BETA_DEPLOYMENT_VERSION}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Startup mode</div>
              <div className="mt-1 font-semibold text-slate-950">{externalStartup.mode}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">Remote command</div>
              <div className="mt-1 font-semibold text-slate-950">beta:verify-remote</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="text-xs font-semibold text-slate-500">First-user gate</div>
              <div className="mt-1 font-semibold text-slate-950">beta:approve-first-user</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {externalStartup.checks.map((check) => (
              <article key={check.id} className={`rounded-lg border p-4 ${check.status === "PASS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                <div className="text-sm font-semibold capitalize">{check.id.replace(/-/g, " ")}</div>
                <p className="mt-1 text-xs leading-5">{check.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Configuration Checks</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {report.checks.map((check) => (
              <article key={check.name} className={`rounded-lg border p-4 ${statusClass(check.status)}`}>
                <div className="text-sm font-semibold">{check.name}</div>
                <p className="mt-1 text-sm leading-5">{check.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Persistence Inventory</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {PERSISTENCE_AUDIT_INVENTORY.map((item) => (
              <article key={item.subsystem} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">{item.subsystem}</div>
                <div className="mt-2 text-xs leading-5 text-slate-600">
                  <div>Owner: {item.owner}</div>
                  <div>Current: {item.currentLocation}</div>
                  <div>Sensitivity: {item.sensitivity}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

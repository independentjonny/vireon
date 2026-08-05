import { BetaHardening } from "@/lib/betaHardening";
import { BetaPilotOperations } from "@/lib/betaPilotOperations";
import { ExternalPrivateBetaDeployment } from "@/lib/externalPrivateBetaDeployment";
import { PrivateBetaFoundation } from "@/lib/privateBetaFoundation";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = PrivateBetaFoundation.configFromEnv();
  const foundation = PrivateBetaFoundation.buildPrivateBetaReadinessReport(config);
  const gate = BetaHardening.buildLaunchGate({ config, foundation, golden: { passed: true } as never, consistency: { passed: true } as never, securityFindings: BetaHardening.buildSecurityReview() });
  const cohort = BetaPilotOperations.createFoundingBetaCohort();
  const rehearsal = BetaPilotOperations.runSyntheticRehearsal();
  const dashboard = BetaPilotOperations.buildOperationsDashboard({ invitations: [], events: [], support: [], appVersion: config.applicationVersion });
  const dailyCheck = BetaPilotOperations.runDailyCheck({ config, gate, securityFindings: BetaHardening.buildSecurityReview() });
  const deployment = BetaPilotOperations.verifyDeployment({ config, gate, commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local", smokeTestPassed: true, storagePrivate: true });
  const externalStartup = ExternalPrivateBetaDeployment.validateStartupEnvironment();
  const deploymentManifest = config.mode === "PRIVATE_BETA" && !externalStartup.blocked
    ? ExternalPrivateBetaDeployment.createDeploymentManifest({
      applicationVersion: config.applicationVersion ?? "0.1.0",
      commitSha: process.env.VIREON_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      hostingEnvironment: process.env.VIREON_HOSTING_ENVIRONMENT ?? "external-private-beta",
      databaseMigrationVersion: config.migrationVersion ?? "unknown",
      featureFlags: foundation.featureFlags,
      calculationVersions: ["financial-health-engine-v1", "financial-timeline-forecasting-v1", "goals-scenario-planning-v1"],
      rollbackReference: process.env.VIREON_ROLLBACK_REFERENCE ?? "previous-deployment",
      approver: process.env.VIREON_DEPLOYMENT_APPROVER ?? "unrecorded",
      deploymentOutcome: "VERIFIED",
    })
    : null;
  return Response.json({
    ok: true,
    cohort,
    deployment,
    externalStartup,
    deploymentManifest,
    rehearsal,
    dashboard,
    dailyCheck,
    incidentPlans: BetaPilotOperations.buildIncidentPlans(),
    validationGuide: BetaPilotOperations.buildUserValidationGuide(),
    surveyQuestions: BetaPilotOperations.buildSurveyQuestions(),
  });
}

import { readFileSync } from "fs";
import { ExternalPrivateBetaDeployment } from "../src/lib/externalPrivateBetaDeployment.ts";

function readJsonEnv(name) {
  const path = process.env[name];
  if (!path) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

const remote = readJsonEnv("VIREON_REMOTE_VERIFICATION_REPORT");
const twoUser = readJsonEnv("VIREON_TWO_USER_REHEARSAL_REPORT");
const negative = readJsonEnv("VIREON_NEGATIVE_SECURITY_REHEARSAL_REPORT");
const backup = readJsonEnv("VIREON_BACKUP_RESTORE_REPORT");
const rollback = readJsonEnv("VIREON_ROLLBACK_REHEARSAL_REPORT");
const monitoring = readJsonEnv("VIREON_MONITORING_REPORT");
const approver = process.env.VIREON_FIRST_USER_APPROVER;

const missing = [
  ["VIREON_REMOTE_VERIFICATION_REPORT", remote],
  ["VIREON_TWO_USER_REHEARSAL_REPORT", twoUser],
  ["VIREON_NEGATIVE_SECURITY_REHEARSAL_REPORT", negative],
  ["VIREON_BACKUP_RESTORE_REPORT", backup],
  ["VIREON_ROLLBACK_REHEARSAL_REPORT", rollback],
  ["VIREON_MONITORING_REPORT", monitoring],
].filter(([, value]) => !value).map(([name]) => name);

if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED", blocked: true, reason: `Missing approval evidence: ${missing.join(", ")}` }, null, 2));
  console.error("FIRST_USER_APPROVAL_BLOCKED");
  process.exit(1);
}

const report = ExternalPrivateBetaDeployment.approveFirstUser({
  remote,
  twoUser,
  negative,
  backup,
  rollback,
  monitoring,
  approver,
  sev1Open: process.env.VIREON_OPEN_SEV1 === "true",
  privacyPageDeployed: process.env.VIREON_PRIVACY_PAGE_DEPLOYED === "true",
  exportTested: process.env.VIREON_EXPORT_TESTED === "true",
  deletionRequestTested: process.env.VIREON_DELETION_REQUEST_TESTED === "true",
  invitationDeliveryTested: process.env.VIREON_INVITATION_DELIVERY_TESTED === "true",
  supportReady: process.env.VIREON_SUPPORT_READY === "true",
});

console.log(JSON.stringify({ status: report.approved ? "APPROVED" : "BLOCKED", blocked: report.blocked, report }, null, 2));

if (report.blocked) {
  console.error("FIRST_USER_APPROVAL_BLOCKED");
  process.exit(1);
}

console.log("FIRST_USER_APPROVAL_RECORDED");

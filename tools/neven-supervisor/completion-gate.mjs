import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const defaultReceiptPath = ".verification/latest.json";
function scopedReceipt(name) {
  if (!/^\.verification\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.json$/.test(name)) throw new Error("Receipt must be a JSON file inside .verification.");
  return name;
}
const hash = value => createHash("sha256").update(value).digest("hex");
function local(root, name) {
  if (typeof name !== "string" || !name || path.isAbsolute(name)) throw new Error("Evidence paths must be repository relative.");
  const resolved = fs.realpathSync(path.resolve(root, name));
  const relative = path.relative(fs.realpathSync(root), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Evidence must stay inside the repository.");
  return resolved;
}
export function sourceFingerprint(root) {
  const files = execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard", "-z"], { cwd: root }).toString().split("\0").filter(Boolean);
  return hash(JSON.stringify([...new Set(files)].sort().filter(name => !name.startsWith(".verification/")).map(name => {
    const full = path.join(root, name);
    return [name, fs.existsSync(full) ? hash(fs.readFileSync(full)) : "DELETED"];
  })));
}
function validatePlan(plan) {
  if (!plan || typeof plan.task !== "string" || !plan.task.trim() || !["ui", "code", "artifact"].includes(plan.kind)) throw new Error("Plan requires a task and kind: ui, code or artifact.");
  if (!Array.isArray(plan.criteria) || !plan.criteria.length || !Array.isArray(plan.checks) || !plan.checks.length) throw new Error("Acceptance criteria and executable checks are required.");
  const ids = new Set();
  for (const criterion of plan.criteria) {
    if (!criterion.id || ids.has(criterion.id) || !criterion.description?.trim()) throw new Error("Criteria need unique IDs and observable descriptions.");
    ids.add(criterion.id);
    if (!plan.checks.some(check => check.criteria?.includes(criterion.id))) throw new Error(`Criterion ${criterion.id} has no check.`);
  }
  for (const check of plan.checks) {
    if (!check.id || !Array.isArray(check.criteria) || !check.criteria.length || check.criteria.some(id => !ids.has(id)) || typeof check.program !== "string" || !Array.isArray(check.args) || check.args.some(arg => typeof arg !== "string")) throw new Error("Invalid check definition.");
    if (!Array.isArray(check.evidence) || !check.evidence.length) throw new Error(`Check ${check.id} needs evidence files.`);
  }
  if (new Set(plan.checks.map(check => check.id)).size !== plan.checks.length) throw new Error("Check IDs must be unique.");
  if (plan.kind === "ui") {
    for (const role of ["render", "visual-review", "geometry", "interaction"]) {
      if (!plan.checks.some(check => check.role === role)) throw new Error(`UI verification requires ${role}.`);
    }
  }
}
export function verifyCompletion(root, task, receiptFile = defaultReceiptPath) {
  try {
    const receiptPath = scopedReceipt(receiptFile);
    const receipt = JSON.parse(fs.readFileSync(path.join(root, receiptPath), "utf8"));
    if (!receipt.ok || !receipt.executed || (task && receipt.task !== task)) throw new Error("No passing receipt for this task.");
    const plan = JSON.parse(fs.readFileSync(local(root, receipt.planPath), "utf8"));
    validatePlan(plan);
    if (receipt.task !== plan.task || receipt.planHash !== hash(JSON.stringify(plan))) throw new Error("Verification plan changed.");
    if (receipt.fingerprint !== sourceFingerprint(root)) throw new Error("Source changed after verification. Rerun the gate.");
    if (receipt.checks.length !== plan.checks.length) throw new Error("Missing check results.");
    for (const check of plan.checks) {
      const result = receipt.checks.find(result => result.id === check.id);
      if (!result?.ok || result.code !== 0) throw new Error(`Check ${check.id} did not pass.`);
      for (const name of [...check.evidence, result.log]) {
        if (!receipt.evidence[name] || receipt.evidence[name] !== hash(fs.readFileSync(local(root, name)))) throw new Error(`Evidence missing or changed: ${name}`);
      }
    }
    return { ok: true, task: receipt.task, receipt: receiptPath };
  } catch (error) { return { ok: false, reason: error.message }; }
}
export function runVerification(root, planPath, receiptFile = defaultReceiptPath) {
  const receiptPath = scopedReceipt(receiptFile);
  fs.mkdirSync(path.dirname(path.join(root, receiptPath)), { recursive: true });
  // Invalidate the previous pass before parsing or running anything.
  const receipt = { ok: false, executed: true, planPath, checks: [], evidence: {} };
  const save = () => fs.writeFileSync(path.join(root, receiptPath), JSON.stringify(receipt, null, 2));
  save();
  try {
    const plan = JSON.parse(fs.readFileSync(local(root, planPath), "utf8"));
    validatePlan(plan);
    receipt.task = plan.task;
    receipt.planHash = hash(JSON.stringify(plan));
    const before = sourceFingerprint(root);
    for (const [index, check] of plan.checks.entries()) {
      const started = Date.now();
      const result = spawnSync(check.program === "node" ? process.execPath : check.program, check.args, { cwd: root, encoding: "utf8", timeout: 600000, maxBuffer: 8 * 1024 * 1024, shell: false });
      const log = path.posix.join(path.posix.dirname(receiptPath), `check-${index}.log`);
      fs.writeFileSync(path.join(root, log), `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`);
      receipt.evidence[log] = hash(fs.readFileSync(path.join(root, log)));
      const entry = { id: check.id, code: result.status, ok: result.status === 0 && !result.error, log };
      receipt.checks.push(entry);
      if (!entry.ok) throw new Error(`Check failed: ${check.id}. See ${log}`);
      for (const name of check.evidence) {
        const full = local(root, name);
        const stat = fs.statSync(full);
        if (!stat.isFile() || !stat.size || stat.mtimeMs < started - 1000) throw new Error(`Evidence was not freshly produced: ${name}`);
        receipt.evidence[name] = hash(fs.readFileSync(full));
      }
    }
    receipt.fingerprint = sourceFingerprint(root);
    if (before !== receipt.fingerprint) throw new Error("Verification changed source files. Rerun after stabilising the source.");
    receipt.ok = true;
  } catch (error) { receipt.reason = error.message; }
  receipt.finishedAt = new Date().toISOString();
  save();
  return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const receiptFile = process.env.VIREON_VERIFICATION_RECEIPT ?? defaultReceiptPath;
  const result = process.argv[2] === "check" ? verifyCompletion(root, process.argv[3], receiptFile) : runVerification(root, process.argv[2] ?? ".ai/verification-task.json", receiptFile);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

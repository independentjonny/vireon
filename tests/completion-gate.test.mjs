import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runVerification, verifyCompletion } from "../tools/neven-supervisor/completion-gate.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vireon-gate-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  fs.writeFileSync(path.join(root, ".gitignore"), ".verification/\n");
  fs.writeFileSync(path.join(root, "source.txt"), "original");
  const plan = { task: "Verify example outcome", kind: "code", criteria: [{ id: "C1", description: "Expected source content is observed" }], checks: [{ id: "content", criteria: ["C1"], program: "node", args: ["-e", "const fs=require('fs');if(fs.readFileSync('source.txt','utf8')!=='original')process.exit(1);fs.writeFileSync('.verification/result.txt','Observed original content');"], evidence: [".verification/result.txt"] }] };
  const save = () => fs.writeFileSync(path.join(root, "plan.json"), JSON.stringify(plan));
  save();
  return { root, plan, save };
}
test("missing receipt fails closed", t => { const { root } = fixture(t); assert.equal(verifyCompletion(root).ok, false); });
test("concurrent task receipts and logs are isolated without weakening fingerprints", t => {
  const { root, plan } = fixture(t), scoped = ".verification/control-centre/receipt.json";
  const other = structuredClone(plan); other.task = "Other task"; other.checks[0].args[1] = other.checks[0].args[1].replaceAll("result.txt", "other-result.txt"); other.checks[0].evidence = [".verification/other-result.txt"];
  fs.writeFileSync(path.join(root, "other.json"), JSON.stringify(other));
  assert.equal(runVerification(root, "plan.json", scoped).ok, true);
  assert.equal(runVerification(root, "other.json").ok, true);
  assert.equal(verifyCompletion(root, plan.task, scoped).ok, true);
  assert.equal(verifyCompletion(root, other.task).ok, true);
  assert.ok(fs.existsSync(path.join(root, ".verification/control-centre/check-0.log")));
  fs.writeFileSync(path.join(root, "source.txt"), "modified");
  assert.equal(verifyCompletion(root, plan.task, scoped).ok, false);
});
test("receipt paths cannot escape the verification directory", t => {
  const { root } = fixture(t);
  for (const name of ["../receipt.json", ".verification/../receipt.json", "C:/receipt.json"]) assert.throws(() => runVerification(root, "plan.json", name), /inside .verification/);
});
test("passing real check is bound to task, source and evidence", t => {
  const { root } = fixture(t);
  assert.equal(runVerification(root, "plan.json").ok, true);
  assert.equal(verifyCompletion(root, "Verify example outcome").ok, true);
  assert.equal(verifyCompletion(root, "Different task").ok, false);
  fs.writeFileSync(path.join(root, "source.txt"), "changed");
  assert.equal(verifyCompletion(root).ok, false);
});
test("modified evidence invalidates pass", t => {
  const { root } = fixture(t); runVerification(root, "plan.json");
  fs.writeFileSync(path.join(root, ".verification/result.txt"), "altered");
  assert.equal(verifyCompletion(root).ok, false);
});
test("failed command replaces earlier passing receipt", t => {
  const { root } = fixture(t); assert.equal(runVerification(root, "plan.json").ok, true);
  fs.writeFileSync(path.join(root, "source.txt"), "wrong");
  assert.equal(runVerification(root, "plan.json").ok, false);
  assert.equal(verifyCompletion(root).ok, false);
});
test("malformed plan invalidates prior receipt", t => {
  const { root } = fixture(t); runVerification(root, "plan.json");
  fs.writeFileSync(path.join(root, "plan.json"), "{");
  assert.equal(runVerification(root, "plan.json").ok, false);
  assert.equal(verifyCompletion(root).ok, false);
});
test("uncovered criteria and missing UI review fail closed", t => {
  const { root, plan, save } = fixture(t);
  plan.criteria.push({ id: "C2", description: "Uncovered" }); save();
  assert.equal(runVerification(root, "plan.json").ok, false);
  plan.criteria.pop(); plan.kind = "ui"; save();
  assert.match(runVerification(root, "plan.json").reason, /requires render/);
});
test("stale evidence does not pass a successful no-op command", t => {
  const { root, plan, save } = fixture(t);
  fs.mkdirSync(path.join(root, ".verification"));
  const output = path.join(root, ".verification/result.txt");
  fs.writeFileSync(output, "old"); fs.utimesSync(output, new Date(0), new Date(0));
  plan.checks[0].args = ["-e", "process.exit(0)"]; save();
  assert.match(runVerification(root, "plan.json").reason, /freshly produced/);
});
test("source changes during checks prevent completion", t => {
  const { root, plan, save } = fixture(t);
  plan.checks[0].args = ["-e", "const fs=require('fs');fs.writeFileSync('source.txt','modified');fs.writeFileSync('.verification/result.txt','output');"]; save();
  assert.match(runVerification(root, "plan.json").reason, /changed source/);
});

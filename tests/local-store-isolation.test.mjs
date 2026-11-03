import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

test("legacy store test writes stay in an isolated worker directory", t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "vireon-local-isolation-"));
  t.after(() => {
    assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const original = path.resolve(".ai/local-data/transactions.json");
  const fingerprint = () => fs.existsSync(original) ? createHash("sha256").update(fs.readFileSync(original)).digest("hex") : null;
  const before = fingerprint();
  const source = `const store=await import(${JSON.stringify(pathToFileURL(path.resolve("src/lib/localStore.ts")).href)});store.saveLocalTransactions([{id:"synthetic-isolation-fixture"}]);console.log(process.pid);`;
  const pid = execFileSync(process.execPath, ["--experimental-strip-types", "--experimental-loader", "./scripts/ts-paths-loader.mjs", "--input-type=module", "-e", source], { encoding: "utf8", env: { ...process.env, NODE_ENV: "test", LOCAL_DATA_DIR_OVERRIDE: temporary }, windowsHide: true }).trim();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temporary, `worker-${pid}`, "transactions.json"), "utf8")), [{ id: "synthetic-isolation-fixture" }]);
  assert.equal(fingerprint(), before, "Original transactions must remain byte-for-byte unchanged");
});

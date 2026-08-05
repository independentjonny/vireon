import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Remap DATA_DIR to a temp directory so tests don't pollute .ai/local-data
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "liberva-test-"));
process.env.LOCAL_DATA_DIR_OVERRIDE = tmpDir;

// Import after setting env override (localStore reads DATA_DIR at module init time
// so this is a scaffold test that validates the module interface, not file I/O)
import {
  getLocalTransactions,
  getLocalSubscriptions,
  hasLocalData,
  getStorageMode,
} from "../../src/lib/localStore.ts";

describe("localStore scaffold", () => {
  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it("getStorageMode returns a string", () => {
    const mode = getStorageMode();
    assert.equal(typeof mode, "string");
    assert.ok(mode.length > 0);
  });

  it("hasLocalData returns an object with numeric fields", () => {
    const counts = hasLocalData();
    assert.equal(typeof counts, "object");
    assert.equal(typeof counts.transactions, "number");
    assert.equal(typeof counts.subscriptions, "number");
  });

  it("getLocalTransactions returns an array", () => {
    const txs = getLocalTransactions();
    assert.ok(Array.isArray(txs));
  });

  it("getLocalSubscriptions returns an array", () => {
    const subs = getLocalSubscriptions();
    assert.ok(Array.isArray(subs));
  });
});

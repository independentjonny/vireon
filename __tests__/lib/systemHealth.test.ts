import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemComponents } from "../../src/lib/systemHealth.ts";

describe("systemHealth — Database health card regression guard", () => {
  it("Database component exists in system health list", () => {
    const components = buildSystemComponents();
    const db = components.find((c) => c.name === "Database");
    assert.ok(db, "Database component must exist in systemComponents");
  });

  it("Database row message contains 'Connected database configuration detected'", () => {
    const components = buildSystemComponents();
    const db = components.find((c) => c.name === "Database");
    assert.ok(db, "Database component must exist");
    assert.ok(
      db.message.includes("Connected database configuration detected"),
      `Expected message to include 'Connected database configuration detected', got: '${db.message}'`
    );
  });

  it("Database row message does not contain 'DATABASE_URL needed'", () => {
    const components = buildSystemComponents();
    const db = components.find((c) => c.name === "Database");
    assert.ok(db, "Database component must exist");
    assert.ok(
      !db.message.includes("DATABASE_URL needed"),
      `Message must not contain 'DATABASE_URL needed', got: '${db.message}'`
    );
  });

  it("Database row has green status", () => {
    const components = buildSystemComponents();
    const db = components.find((c) => c.name === "Database");
    assert.ok(db, "Database component must exist");
    assert.equal(db.status, "green");
  });
});

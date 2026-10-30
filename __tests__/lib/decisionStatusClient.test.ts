import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { saveDecisionStatus } from "../../src/lib/decisionStatusClient.ts";

test("decision changes use only a server-acknowledged status without client-supplied ownership", async () => {
  const states = await saveDecisionStatus("decision-1", "Reviewed", async (url, init) => {
    assert.equal(url, "/api/decisions");
    assert.deepEqual(JSON.parse(String(init?.body)), { decisionId: "decision-1", status: "Reviewed" });
    assert.ok(init?.signal);
    return Response.json({ states: { "decision-1": { status: "Reviewed" } } });
  });
  assert.equal(states["decision-1"].status, "Reviewed");
});

test("network errors, outages and unacknowledged writes cannot look like saved decision updates", async () => {
  const responses = [
    async () => { throw new Error("sensitive network details"); },
    async () => Response.json({ error: "sensitive backend details" }, { status: 503 }),
    async () => new Response("not json"),
    async () => Response.json({ states: {} }),
    async () => Response.json({ states: { "decision-1": { status: "New" } } }),
  ];
  for (const fetchImpl of responses) await assert.rejects(saveDecisionStatus("decision-1", "Reviewed", fetchImpl), error => {
    assert.match((error as Error).message, /Could not confirm the saved decision status/);
    assert.doesNotMatch((error as Error).message, /sensitive/);
    return true;
  });
});

test("the app shell cannot silently create browser-authoritative decision history", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /localStorage|decision-action-fallback|data-decision-status/);
});

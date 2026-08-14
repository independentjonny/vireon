import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Financial Position route is authenticated and reads the canonical server model", () => {
  const page = source("src/app/financial-profile/page.tsx");
  assert.match(page, /requireServerPageSession\("\/financial-profile"\)/);
  assert.match(page, /createFinancialPositionReadServiceFromEnv\(\)\.read\(session\)/);
  assert.match(page, /FinancialProfileBuilderClient position=\{position\}/);
});

test("Financial Position answers the three canonical customer questions", () => {
  const client = source("src/app/components/FinancialProfileBuilderClient.tsx");
  assert.match(client, /What Vireon knows/);
  assert.match(client, /What is importantly missing/);
  assert.match(client, /What should I do next\?/);
  assert.match(client, /Confirmed data only/);
  assert.match(client, /Missing means Vireon does not yet have a confirmed current record\. It never means zero\./);
});

test("Financial Position routes changes to canonical owning workflows", () => {
  const client = source("src/app/components/FinancialProfileBuilderClient.tsx");
  for (const href of ["/accounts", "/balance-sheet", "/cash-flow", "/housing-scenarios", "/financial-vault"]) {
    assert.match(client, new RegExp(href.replace("/", "\\/")));
  }
  assert.match(client, /Figures use confirmed current records only/);
});

test("legacy builder journey language is absent from the rendered component", () => {
  const client = source("src/app/components/FinancialProfileBuilderClient.tsx");
  for (const legacy of ["Financial Profile Builder", "Update Financial Profile", "Add category", "Add Category", "profile checklist", "I’ll add this later", "Not started · 0 records"]) {
    assert.doesNotMatch(client, new RegExp(legacy));
  }
});

test("mobile navigation exposes the unconditional Financial Position route", () => {
  const navigation = source("src/app/components/MobileNav.tsx");
  assert.match(navigation, /label: "Financial Profile",\s+items: \[\["Financial Position", "\/financial-profile"\]\]/);
});

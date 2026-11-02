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
  assert.match(page, /BaselineFinancialPosition position=\{position\}/);
});

test("Financial Position answers the three canonical customer questions", () => {
  const client = source("src/app/components/FinancialProfileBuilderClient.tsx");
  assert.match(client, /What Vireon knows/);
  assert.match(client, /What is importantly missing/);
  assert.match(client, /What should I do next\?/);
  assert.match(client, /Confirmed data only/);
  assert.match(client, /Missing means Vireon does not yet have a confirmed current record\. It never means zero\./);
  assert.match(client, /position\.monthlyCashFlow\.missingInputs\.map/);
  assert.match(client, /Complete cash-flow input/);
});

test("Financial Position routes changes to canonical owning workflows", () => {
  const client = source("src/app/components/FinancialProfileBuilderClient.tsx");
  for (const href of ["/accounts", "/balance-sheet", "/cash-flow", "/financial-profile/property", "/financial-vault"]) {
    assert.match(client, new RegExp(href.replace("/", "\\/")));
  }
  assert.match(client, /Figures use confirmed current records only/);
});

test("Property summary opens the authenticated persisted property and mortgage detail", () => {
  const client = source("src/app/components/FinancialProfileBuilderClient.tsx");
  const page = source("src/app/financial-profile/property/page.tsx");
  assert.match(client, /href: "\/financial-profile\/property"/);
  assert.match(client, /href: "\/financial-profile\/property#mortgage"/);
  assert.match(page, /requireServerPageSession\("\/financial-profile\/property"\)/);
  assert.match(page, /createFinancialPositionReadServiceFromEnv\(\)\.read\(session\)/);
  assert.match(page, /position\.propertyDetails/);
  assert.match(page, /position\.mortgageDetails/);
  assert.match(page, /property\.value\.address/);
  assert.match(page, /property\.value\.marketValue/);
  assert.match(page, /mortgage\.value\.repaymentAmount/);
  assert.match(page, /Supporting evidence/);
  assert.match(page, /documentImportStatus\.documents/);
  assert.doesNotMatch(page, /housing-scenarios/);
});

test("legacy builder journey language is absent from the rendered component", () => {
  const client = source("src/app/components/FinancialProfileBuilderClient.tsx");
  for (const legacy of ["Financial Profile Builder", "Update Financial Profile", "Add category", "Add Category", "profile checklist", "I’ll add this later", "Not started · 0 records"]) {
    assert.doesNotMatch(client, new RegExp(legacy));
  }
});

test("desktop and mobile use shared navigation and retain the brand", () => {
  for (const path of ["src/app/components/AppShell.tsx", "src/app/components/MobileNav.tsx"]) {
    assert.match(source(path), /workspaceNavigation/);
    assert.match(source(path), /selectedWorkspaceHref/);
    assert.match(source(path), /aria-current/);
  }
  assert.match(source("src/app/components/AppShell.tsx"), /src="\/vireon2-white\.png"/);
  assert.match(source("src/app/financial-profile/page.tsx"), /<AppShell active="financial-position">/);
});

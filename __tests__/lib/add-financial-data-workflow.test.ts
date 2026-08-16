import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Add financial data route is authenticated and uses the dedicated shell state", () => {
  const page = source("src/app/financial-profile/add-data/page.tsx");
  assert.match(page, /requireServerPageSession\("\/financial-profile\/add-data"\)/);
  assert.match(page, /<AppShell active="financial-data">/);
  assert.match(page, /<AddFinancialDataClient \/>/);
});

test("desktop and mobile navigation expose both Financial Profile journeys", () => {
  for (const path of ["src/app/components/AppShell.tsx", "src/app/components/MobileNav.tsx"]) {
    const navigation = source(path);
    assert.match(navigation, /Financial Position/);
    assert.match(navigation, /Add financial data/);
    assert.match(navigation, /\/financial-profile\/add-data/);
  }
  assert.match(source("src/app/components/AppShell.tsx"), /src="\/vireon2-white\.png"/);
});

test("workflow preserves Vault authority and explicit confirmation semantics", () => {
  const client = source("src/app/components/AddFinancialDataClient.tsx");
  for (const copy of [
    "Choose information",
    "Add details & evidence",
    "Review & confirm",
    "Choose from Document Vault",
    "Continue to Import Review",
    "Nothing updates your position until you confirm it.",
    "Unconfirmed values remain in review and are never treated as zero.",
  ]) assert.match(client, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(client, /fetch\([^)]*financial-vault[^)]*method:\s*["']POST/);
});

test("property workflow uses authenticated Australian G-NAF address selection", () => {
  const client = source("src/app/components/AddFinancialDataClient.tsx");
  const autocomplete = source("src/app/components/AustralianAddressAutocomplete.tsx");
  const route = source("src/app/api/addresses/australian/route.ts");
  const service = source("src/server/services/australianAddressService.ts");
  const proxy = source("src/proxy.ts");

  assert.match(client, /AustralianAddressAutocomplete/);
  assert.match(client, /draft\.addressId \? "High" : draft\.address \? "Check"/);
  assert.match(autocomplete, /role="combobox"/);
  assert.match(autocomplete, /ArrowDown/);
  assert.match(autocomplete, /Geoscape Australia \(G-NAF\)/);
  assert.match(route, /requireSession\(request\)/);
  assert.match(proxy, /\/api\/addresses\/\:path\*/);
  assert.match(service, /GEOSCAPE_API_KEY/);
  assert.match(service, /VERCEL_ENV === "production"/);
  assert.doesNotMatch(autocomplete, /GEOSCAPE_API_KEY/);
});

test("Financial Position routes property and loan gaps into the guided workflow", () => {
  const position = source("src/app/components/FinancialProfileBuilderClient.tsx");
  assert.match(position, /\/financial-profile\/add-data\?category=property/);
  assert.match(position, /\/financial-profile\/add-data\?category=loans/);
});

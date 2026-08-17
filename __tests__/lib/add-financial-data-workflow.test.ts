import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { buildAddFinancialDataSummary, buildExistingPropertyDraft } from "../../src/lib/addFinancialDataStatus.ts";
import { propertyWorkflowPresentation, propertyWorkflowState } from "../../src/lib/propertyWorkflowState.ts";
import type { FinancialPositionReadModel } from "../../src/server/services/financialPositionReadService.ts";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("Add financial data route is authenticated and uses the dedicated shell state", () => {
  const page = source("src/app/financial-profile/add-data/page.tsx");
  assert.match(page, /requireServerPageSession\("\/financial-profile\/add-data"\)/);
  assert.match(page, /createFinancialPositionReadServiceFromEnv\(\)\.read\(session\)/);
  assert.match(page, /buildAddFinancialDataSummary\(position\)/);
  assert.match(page, /buildExistingPropertyDraft\(position, property\.id\)/);
  assert.match(page, /savedProperties = position\.propertyDetails/);
  assert.match(page, /<AddFinancialDataClient key=\{existingProperty\?\.recordId \?\? "new-property"\} summary=\{summary\} existingProperty=\{existingProperty\} savedProperties=\{savedProperties\}/);
  assert.match(page, /<AppShell active="financial-data">/);
});

test("category badges, progress and recommendation come from persisted financial position", () => {
  const client = source("src/app/components/AddFinancialDataClient.tsx");
  const summary = source("src/lib/addFinancialDataStatus.ts");
  assert.match(client, /summary\.categoryStatuses\[item\.id\]/);
  assert.match(client, /summary\.confirmedSources/);
  assert.match(client, /summary\.needsReview/);
  assert.match(client, /summary\.reviewedPercent/);
  assert.match(client, /summary\.recommendedCategory/);
  assert.match(summary, /position\.propertyDetails\.length > 0 \? "Confirmed"/);
  assert.match(summary, /position\.liabilities\.length > 0 \? "Confirmed"/);
  assert.doesNotMatch(client, />21<|>19<|53% reviewed|status: "Missing"/);
});

test("a persisted property and mortgage are never labelled missing", () => {
  const position = {
    propertyDetails: [{ id: "property-1" }],
    liabilities: [{ id: "mortgage-1" }],
    income: [],
    superannuation: [],
    cashPosition: { sourceRecordIds: [] },
    documentImportStatus: { documents: [], unresolvedExtractionReviewCount: 2 },
    confidenceSummary: { lowConfidenceFactCount: 1 },
    provenanceSummary: { sourceRecordIds: ["property-1", "mortgage-1"] },
  } as unknown as FinancialPositionReadModel;
  const summary = buildAddFinancialDataSummary(position);
  assert.equal(summary.categoryStatuses.property, "Confirmed");
  assert.equal(summary.categoryStatuses.loans, "Confirmed");
  assert.equal(summary.confirmedSources, 2);
  assert.equal(summary.needsReview, 3);
  assert.notEqual(summary.recommendedCategory, "property");
});

test("saved property, mortgage and linked evidence prefill the update workflow", () => {
  const summary = source("src/lib/addFinancialDataStatus.ts");
  const client = source("src/app/components/AddFinancialDataClient.tsx");
  const detail = source("src/app/financial-profile/property/page.tsx");
  assert.match(summary, /buildExistingPropertyDraft/);
  assert.match(summary, /property\.value\.address/);
  assert.match(summary, /property\.value\.marketValue/);
  assert.match(summary, /mortgage\?\.value\.repaymentAmount/);
  assert.match(summary, /selectedDocuments: position\.documentImportStatus\.documents\.filter/);
  assert.match(client, /Showing your current saved property details/);
  assert.match(client, /Confirm & update Financial Position/);
  assert.match(client, /Add another property/);
  assert.match(client, /Your saved properties/);
  assert.match(client, /savedProperties\.map/);
  assert.match(client, /propertyId=\$\{encodeURIComponent\(property\.recordId\)\}/);
  assert.match(detail, /propertyId=\$\{property\.id\}/);

  const position = {
    propertyDetails: [{ id: "property-1", label: "12 Smith Street", value: { entityKey: "property:gnaf-1", address: "12 Smith Street, Richmond VIC 3121", addressId: "gnaf-1", locality: "Richmond", state: "VIC", postcode: "3121", addressSource: "geoscape-gnaf", propertyType: "House", ownership: "Joint", primaryUse: "Investment", marketValue: 920_000, purchaseDate: "2020-02-03", rentalIncome: true, rentalIncomeAmount: 500, rentalIncomeFrequency: "Weekly", sourceDocumentIds: ["document-1"] } }],
    mortgageDetails: [{ id: "mortgage-1", value: { propertyEntityKey: "property:gnaf-1", lender: "ANZ", balance: 245_000, interestRate: 6.12, repaymentAmount: 450, repaymentFrequency: "Weekly", repaymentType: "Principal and interest", rateType: "Variable", offsetBalance: 12_000, sourceDocumentIds: ["document-1"] } }],
    documentImportStatus: { documents: [{ id: "document-1", fileName: "mortgage.pdf", documentType: "mortgage_statement", uploadedAt: "2026-08-01T00:00:00.000Z", status: "extracted" }] },
  } as unknown as FinancialPositionReadModel;
  const draft = buildExistingPropertyDraft(position);
  assert.equal(draft?.address, "12 Smith Street, Richmond VIC 3121");
  assert.equal(draft?.estimatedValue, "920000");
  assert.equal(draft?.hasMortgage, true);
  assert.equal(draft?.lender, "ANZ");
  assert.equal(draft?.loanBalance, "245000");
  assert.equal(draft?.selectedDocuments[0]?.fileName, "mortgage.pdf");
  assert.equal(draft?.rentalIncome, true);
  assert.equal(draft?.rentalIncomeAmount, "500");
  assert.equal(draft?.rentalIncomeFrequency, "Weekly");

  const secondPosition = {
    ...position,
    propertyDetails: [
      ...position.propertyDetails,
      { id: "property-2", label: "8 Beach Road", value: { entityKey: "property:gnaf-2", address: "8 Beach Road, Geelong VIC 3220", marketValue: 630_000 } },
    ],
  } as unknown as FinancialPositionReadModel;
  const second = buildExistingPropertyDraft(secondPosition, "property-2");
  assert.equal(second?.address, "8 Beach Road, Geelong VIC 3220");
  assert.equal(second?.estimatedValue, "630000");
  assert.equal(second?.hasMortgage, false);
});

test("two persisted properties retain independent identity, mortgage and document linkage", () => {
  const position = {
    propertyDetails: [
      { id: "property-home", label: "10 Home Street", value: { entityKey: "property:home", address: "10 Home Street, Hillside VIC 3037", propertyType: "House", ownership: "Joint", primaryUse: "Owner occupied", marketValue: 970_000, sourceDocumentIds: ["document-home"] } },
      { id: "property-unit", label: "20 Unit Road", value: { entityKey: "property:unit", address: "20 Unit Road, Melbourne VIC 3000", propertyType: "Apartment", ownership: "Sole", primaryUse: "Secondary residence", marketValue: 630_000, sourceDocumentIds: ["document-unit"] } },
    ],
    mortgageDetails: [
      { id: "mortgage-home", value: { propertyEntityKey: "property:home", lender: "Home Bank", balance: 270_000, repaymentAmount: 2_100, sourceDocumentIds: ["document-home"] } },
      { id: "mortgage-unit", value: { propertyEntityKey: "property:unit", lender: "Unit Bank", balance: 110_000, repaymentAmount: 900, sourceDocumentIds: ["document-unit"] } },
    ],
    documentImportStatus: { documents: [
      { id: "document-home", fileName: "home-mortgage.pdf", documentType: "mortgage_statement", uploadedAt: "2026-08-01T00:00:00.000Z", status: "extracted" },
      { id: "document-unit", fileName: "unit-mortgage.pdf", documentType: "mortgage_statement", uploadedAt: "2026-08-02T00:00:00.000Z", status: "extracted" },
    ] },
  } as unknown as FinancialPositionReadModel;

  const home = buildExistingPropertyDraft(position, "property-home");
  const unit = buildExistingPropertyDraft(position, "property-unit");

  assert.deepEqual(
    { id: home?.recordId, address: home?.address, value: home?.estimatedValue, type: home?.propertyType, use: home?.primaryUse, lender: home?.lender, balance: home?.loanBalance, document: home?.selectedDocuments[0]?.fileName },
    { id: "property-home", address: "10 Home Street, Hillside VIC 3037", value: "970000", type: "House", use: "Owner occupied", lender: "Home Bank", balance: "270000", document: "home-mortgage.pdf" },
  );
  assert.deepEqual(
    { id: unit?.recordId, address: unit?.address, value: unit?.estimatedValue, type: unit?.propertyType, use: unit?.primaryUse, lender: unit?.lender, balance: unit?.loanBalance, document: unit?.selectedDocuments[0]?.fileName },
    { id: "property-unit", address: "20 Unit Road, Melbourne VIC 3000", value: "630000", type: "Apartment", use: "Secondary residence", lender: "Unit Bank", balance: "110000", document: "unit-mortgage.pdf" },
  );
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
  const workflowSources = client + source("src/lib/propertyWorkflowState.ts");
  for (const copy of [
    "Choose information",
    "Add details & evidence",
    "Review & confirm",
    "Choose from Document Vault",
    "Confirm & save to Financial Position",
    "Save draft in this browser",
    "Your confirmed property and mortgage appear immediately in Financial Position.",
    "Import Review separately verifies values extracted from supporting documents.",
  ]) assert.match(workflowSources, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /form\.set\("file", uploadFile\)/);
  assert.match(client, /form\.set\("documentType", uploadType\)/);
  assert.match(client, /fetch\("\/api\/financial-vault", \{ method: "POST", body: form/);
  assert.match(client, /action: "save-property-position"/);
  assert.match(client, /window\.location\.assign\("\/financial-profile\?saved=property"\)/);
  assert.doesNotMatch(client, /Continue to Import Review/);
});

test("confirmed saved properties are distinguished from unsaved edit progress", () => {
  const client = source("src/app/components/AddFinancialDataClient.tsx");
  const workflowSources = client + source("src/lib/propertyWorkflowState.ts");
  for (const copy of [
    "Saved record",
    "Details & evidence",
    "Confirmed summary",
    "Review changes",
    "View confirmed summary",
    "Record status: Confirmed",
    "Current action:",
    "Viewing saved details",
    "Editing saved details",
    "These details are already saved and confirmed",
  ]) assert.match(workflowSources, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /draftFingerprint\(draft\) !== draftFingerprint\(originalDraft\)/);
  assert.match(client, /propertyWorkflowPresentation/);
  assert.match(client, /propertyPresentation\.primaryAction/);
  assert.doesNotMatch(client, /disabled=\{editingExisting && !hasPendingChanges\}/);
  assert.doesNotMatch(client, /editingExisting && propertyFlow \? "Current saved details"/);
});

test("property workflow state matrix keeps accepted records complete until edited", () => {
  const confirmed = propertyWorkflowPresentation(propertyWorkflowState(true, false));
  assert.equal(confirmed.recordStatus, "Confirmed");
  assert.deepEqual(confirmed.completedSteps, [true, true, true]);
  assert.deepEqual(confirmed.steps, ["Saved record", "Details & evidence", "Confirmed summary"]);
  assert.equal(confirmed.primaryAction, "View confirmed summary");

  const viewed = propertyWorkflowPresentation(propertyWorkflowState(true, false));
  assert.deepEqual(viewed, confirmed);

  const edited = propertyWorkflowPresentation(propertyWorkflowState(true, true));
  assert.equal(edited.recordStatus, "Unsaved changes");
  assert.deepEqual(edited.completedSteps, [true, false, false]);
  assert.deepEqual(edited.steps, ["Saved record", "Edit details & evidence", "Review changes"]);
  assert.equal(edited.primaryAction, "Review changes");

  const savedAgain = propertyWorkflowPresentation(propertyWorkflowState(true, false));
  assert.deepEqual(savedAgain, confirmed);
});

test("property workflow captures mortgage details and selects existing Vault evidence inline", () => {
  const client = source("src/app/components/AddFinancialDataClient.tsx");
  for (const copy of [
    "This property has a mortgage",
    "Rent received",
    "Rent frequency",
    "Outstanding balance",
    "Interest rate",
    "Repayment amount",
    "Offset account balance",
    "Current Document Vault",
    "Upload & select",
    "Select every document that supports this property or mortgage.",
    "A current mortgage statement helps verify the loan balance, interest rate, repayments and offset account.",
  ]) assert.match(client, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(client, /Loan purpose|loanPurpose|loan applications|lender-ready applications/);
  assert.match(client, /fetch\("\/api\/financial-vault"/);
  assert.match(client, /type="button" onClick=\{\(\) => void openVaultPicker\(\)\}/);
  assert.doesNotMatch(client, /href="\/financial-vault"[^>]*>Choose from Document Vault/);
  assert.doesNotMatch(client, /href="\/financial-vault"[^>]*>Upload new documents/);
  assert.match(client, /selectedDocuments/);
  assert.match(client, /Verify in Import Review/);
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

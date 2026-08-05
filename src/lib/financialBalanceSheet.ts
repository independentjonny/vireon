export type BalanceSheetCategoryId =
  | "cash"
  | "property"
  | "investments"
  | "superannuation"
  | "mortgages"
  | "credit-cards"
  | "personal-car-loans"
  | "other-debt";

export type BalanceSheetSide = "asset" | "liability";

export type BalanceSheetSource = {
  label: "Bank Statement" | "Mortgage Statement" | "Super Statement" | "Manual Entry" | "Broker Estimate";
  updatedAt: string;
};

export type BalanceSheetMetric = {
  label: string;
  value: string;
};

export type BalanceSheetTrend = {
  period: "Daily" | "Monthly" | "Yearly";
  value: number;
  label: string;
};

export type BalanceSheetAccount = {
  id: string;
  name: string;
  value: number;
  source: BalanceSheetSource;
  details: BalanceSheetMetric[];
};

export type BalanceSheetCategory = {
  id: BalanceSheetCategoryId;
  side: BalanceSheetSide;
  label: string;
  value: number;
  monthlyChange: number;
  accountCount: number;
  status: string;
  statusTone: "healthy" | "excellent" | "good" | "moderate" | "review";
  healthIndicator: {
    label: string;
    status: string;
  };
  trend: BalanceSheetTrend;
  primaryMetric: BalanceSheetMetric;
  secondaryMetric?: BalanceSheetMetric;
  aiInsight: string;
  source: BalanceSheetSource;
  accounts: BalanceSheetAccount[];
};

export type FinancialBalanceSheet = {
  asOf: string;
  assetsTotal: number;
  liabilitiesTotal: number;
  netWorth: number;
  monthlyNetChange: number;
  emergencyFundMonths: number;
  currentDeposit: number;
  availableEquity: number;
  borrowingCapacity: number;
  houseReadinessScore: number;
  refinance: {
    monthlySaving: number;
    annualSaving: number;
    confidence: string;
  };
  assets: BalanceSheetCategory[];
  liabilities: BalanceSheetCategory[];
};

function sum(items: { value: number }[]) {
  return items.reduce((total, item) => total + item.value, 0);
}

const updatedAt = "2026-06-13T10:00:00.000Z";

function formatMetricCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function balanceValue(record: { value: Record<string, unknown> }, keys: string[]): number {
  for (const key of keys) {
    const raw = record.value[key];
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[$,\s]/g, "")) : NaN;
    if (Number.isFinite(parsed) && parsed !== 0) return parsed;
  }
  return 0;
}

function sourceFromModel(model: FinancialPositionReadModel): BalanceSheetSource {
  return {
    label: model.provenanceSummary.sourceTypes.includes("MANUAL") ? "Manual Entry" : "Bank Statement",
    updatedAt: model.profileSummary.lastUpdatedAt,
  };
}

function categoryFromRecords(input: {
  id: BalanceSheetCategoryId;
  side: BalanceSheetSide;
  label: string;
  records: FinancialPositionReadModel["confirmedFacts"];
  valueKeys: string[];
  source: BalanceSheetSource;
  status?: string;
  statusTone?: BalanceSheetCategory["statusTone"];
}): BalanceSheetCategory {
  const value = input.records.reduce((total, record) => total + balanceValue(record, input.valueKeys), 0);
  return {
    id: input.id,
    side: input.side,
    label: input.label,
    value,
    monthlyChange: 0,
    accountCount: input.records.length,
    status: input.status ?? (input.records.length ? "Based on confirmed records" : "Missing"),
    statusTone: input.statusTone ?? (input.records.length ? "good" : "review"),
    healthIndicator: { label: "Source", status: input.records.length ? "Confirmed" : "Requires review" },
    trend: { period: "Monthly", value: 0, label: "No persisted trend yet" },
    primaryMetric: { label: input.records.length ? "Confirmed value" : "Missing input", value: input.records.length ? formatMetricCurrency(value) : "Requires review" },
    aiInsight: input.records.length ? `${input.label} is derived from confirmed Financial Vault records.` : `${input.label} is not available until confirmed in the Financial Vault.`,
    source: input.source,
    accounts: input.records.map((record) => ({
      id: record.id,
      name: record.label,
      value: balanceValue(record, input.valueKeys),
      source: input.source,
      details: [
        { label: "Subtype", value: record.subtype },
        { label: "Confidence", value: `${Math.round(record.provenance.confidence * 100)}%` },
      ],
    })),
  };
}

export function buildFinancialBalanceSheetFromReadModel(model: FinancialPositionReadModel): FinancialBalanceSheet {
  const source = sourceFromModel(model);
  const propertyRecords = model.propertyDetails;
  const superRecords = model.superannuation;
  const investmentRecords = model.assets.filter((record) => !model.propertyDetails.includes(record) && !model.superannuation.includes(record) && /investment|shares|etf/i.test(`${record.subtype} ${record.label}`));
  const cashRecords = model.assets.filter((record) => !propertyRecords.includes(record) && !superRecords.includes(record) && !investmentRecords.includes(record));
  const mortgageRecords = model.mortgageDetails;
  const otherDebtRecords = model.liabilities.filter((record) => !mortgageRecords.includes(record));
  const assets = [
    categoryFromRecords({ id: "cash", side: "asset", label: "Cash", records: cashRecords, valueKeys: ["balance", "amount", "value"], source }),
    categoryFromRecords({ id: "property", side: "asset", label: "Property", records: propertyRecords, valueKeys: ["marketValue", "balance", "amount", "value"], source }),
    categoryFromRecords({ id: "investments", side: "asset", label: "Investments", records: investmentRecords, valueKeys: ["marketValue", "balance", "amount", "value"], source }),
    categoryFromRecords({ id: "superannuation", side: "asset", label: "Superannuation", records: superRecords, valueKeys: ["marketValue", "balance", "amount", "value"], source }),
  ];
  const liabilities = [
    categoryFromRecords({ id: "mortgages", side: "liability", label: "Mortgages", records: mortgageRecords, valueKeys: ["balance", "principal", "amount", "value"], source }),
    categoryFromRecords({ id: "credit-cards", side: "liability", label: "Credit Cards", records: otherDebtRecords.filter((record) => /credit|card/i.test(`${record.subtype} ${record.label}`)), valueKeys: ["balance", "amount", "value"], source }),
    categoryFromRecords({ id: "personal-car-loans", side: "liability", label: "Personal / Car Loans", records: otherDebtRecords.filter((record) => /personal|vehicle|car|loan/i.test(`${record.subtype} ${record.label}`)), valueKeys: ["balance", "principal", "amount", "value"], source }),
    categoryFromRecords({ id: "other-debt", side: "liability", label: "Other Debt", records: otherDebtRecords.filter((record) => !/credit|card|personal|vehicle|car|loan/i.test(`${record.subtype} ${record.label}`)), valueKeys: ["balance", "principal", "amount", "value"], source }),
  ];
  const assetsTotal = sum(assets);
  const liabilitiesTotal = sum(liabilities);
  return {
    asOf: model.generatedAt,
    assetsTotal,
    liabilitiesTotal,
    netWorth: assetsTotal - liabilitiesTotal,
    monthlyNetChange: 0,
    emergencyFundMonths: model.expenses.length ? model.cashPosition.confirmedCash / Math.max(1, model.expenses.reduce((total, record) => total + balanceValue(record, ["monthlyAmount", "amount"]), 0)) : 0,
    currentDeposit: model.cashPosition.confirmedCash,
    availableEquity: Math.max(0, propertyRecords.reduce((total, record) => total + balanceValue(record, ["marketValue", "value", "amount"]), 0) - mortgageRecords.reduce((total, record) => total + balanceValue(record, ["balance", "principal", "amount"]), 0)),
    borrowingCapacity: model.vault.borrowing_capacity.estimatedSafeBorrowing,
    houseReadinessScore: 0,
    refinance: {
      monthlySaving: model.vault.refinance_opportunities[0]?.estimatedMonthlySaving ?? 0,
      annualSaving: model.vault.refinance_opportunities[0]?.estimatedAnnualSaving ?? 0,
      confidence: model.vault.refinance_opportunities[0]?.confidence === "high" ? "High" : "Medium",
    },
    assets,
    liabilities,
  };
}

export function getFinancialBalanceSheet(): FinancialBalanceSheet {
  const assets: BalanceSheetCategory[] = [
    {
      id: "cash",
      side: "asset",
      label: "Cash",
      value: 27860,
      monthlyChange: 3200,
      accountCount: 2,
      status: "Healthy",
      statusTone: "healthy",
      healthIndicator: { label: "Emergency Fund", status: "Healthy" },
      trend: { period: "Monthly", value: 3200, label: "+$3,200 this month" },
      primaryMetric: { label: "Emergency runway", value: "4.2 months" },
      aiInsight: "You currently hold 4.2 months of expenses in cash.",
      source: { label: "Bank Statement", updatedAt },
      accounts: [
        {
          id: "cash-offset",
          name: "Macquarie Offset",
          value: 21420,
          source: { label: "Bank Statement", updatedAt },
          details: [
            { label: "Average Balance", value: "$19,870" },
            { label: "Recent Transactions", value: "42 this month" },
            { label: "Monthly Change", value: "+$2,680" },
          ],
        },
        {
          id: "cash-saver",
          name: "High Interest Saver",
          value: 6440,
          source: { label: "Bank Statement", updatedAt },
          details: [
            { label: "Average Balance", value: "$6,210" },
            { label: "Recent Transactions", value: "6 this month" },
            { label: "Monthly Change", value: "+$520" },
          ],
        },
      ],
    },
    {
      id: "property",
      side: "asset",
      label: "Property",
      value: 1610000,
      monthlyChange: 8400,
      accountCount: 2,
      status: "Equity",
      statusTone: "excellent",
      healthIndicator: { label: "Equity", status: "Excellent" },
      trend: { period: "Yearly", value: 5.8, label: "+5.8% estimated value" },
      primaryMetric: { label: "Equity", value: "$1.33M" },
      secondaryMetric: { label: "Loan to value", value: "17%" },
      aiInsight: "Your available equity could support another property purchase.",
      source: { label: "Broker Estimate", updatedAt },
      accounts: [
        {
          id: "property-smith",
          name: "12 Smith St",
          value: 980000,
          source: { label: "Broker Estimate", updatedAt },
          details: [
            { label: "Market Value", value: "$980,000" },
            { label: "Mortgage", value: "$275,000" },
            { label: "Equity", value: "$705,000" },
          ],
        },
        {
          id: "property-apartment",
          name: "Docklands Apartment",
          value: 630000,
          source: { label: "Manual Entry", updatedAt },
          details: [
            { label: "Market Value", value: "$630,000" },
            { label: "Mortgage", value: "$0" },
            { label: "Equity", value: "$630,000" },
          ],
        },
      ],
    },
    {
      id: "investments",
      side: "asset",
      label: "Investments",
      value: 480000,
      monthlyChange: 1120,
      accountCount: 4,
      status: "Moderate",
      statusTone: "moderate",
      healthIndicator: { label: "Diversification", status: "Moderate" },
      trend: { period: "Daily", value: 1120, label: "+$1,120 today" },
      primaryMetric: { label: "Today's change", value: "+$1,120" },
      secondaryMetric: { label: "12 month return", value: "+8.4%" },
      aiInsight: "Most of your wealth is concentrated in property, so new contributions could improve diversification.",
      source: { label: "Manual Entry", updatedAt },
      accounts: [
        {
          id: "investment-vanguard",
          name: "Vanguard ETF Portfolio",
          value: 292000,
          source: { label: "Manual Entry", updatedAt },
          details: [
            { label: "Performance", value: "+8.9% 12m" },
            { label: "Allocation", value: "Global equities" },
            { label: "Returns", value: "+$25,400" },
          ],
        },
        {
          id: "investment-broker",
          name: "Brokerage Account",
          value: 188000,
          source: { label: "Manual Entry", updatedAt },
          details: [
            { label: "Performance", value: "+7.6% 12m" },
            { label: "Allocation", value: "AU equities" },
            { label: "Returns", value: "+$13,200" },
          ],
        },
      ],
    },
    {
      id: "superannuation",
      side: "asset",
      label: "Superannuation",
      value: 355000,
      monthlyChange: 2400,
      accountCount: 1,
      status: "Above Track",
      statusTone: "good",
      healthIndicator: { label: "Retirement Track", status: "Good" },
      trend: { period: "Yearly", value: 9.2, label: "+9.2% 12 month growth" },
      primaryMetric: { label: "12 month growth", value: "+9.2%" },
      secondaryMetric: { label: "Contributions", value: "$1,220/mo" },
      aiInsight: "You are tracking above average for your age group.",
      source: { label: "Super Statement", updatedAt },
      accounts: [
        {
          id: "super-australian",
          name: "AustralianSuper Balanced",
          value: 355000,
          source: { label: "Super Statement", updatedAt },
          details: [
            { label: "Performance", value: "+9.2% 12m" },
            { label: "Insurance", value: "Life + TPD active" },
            { label: "Fees", value: "$34/mo" },
            { label: "Contributions", value: "$1,220/mo" },
          ],
        },
      ],
    },
  ];

  const liabilities: BalanceSheetCategory[] = [
    {
      id: "mortgages",
      side: "liability",
      label: "Mortgages",
      value: 275000,
      monthlyChange: -2150,
      accountCount: 1,
      status: "Needs Review",
      statusTone: "review",
      healthIndicator: { label: "Interest Rate", status: "Needs Review" },
      trend: { period: "Monthly", value: -2150, label: "$2,150 repayment" },
      primaryMetric: { label: "Interest Rate", value: "5.84%" },
      secondaryMetric: { label: "Monthly Repayment", value: "$2,150" },
      aiInsight: "Refinancing may reduce repayments.",
      source: { label: "Mortgage Statement", updatedAt },
      accounts: [
        {
          id: "mortgage-smith",
          name: "12 Smith St Home Loan",
          value: 275000,
          source: { label: "Mortgage Statement", updatedAt },
          details: [
            { label: "Balance", value: "$275,000" },
            { label: "Interest Rate", value: "5.84%" },
            { label: "Repayments", value: "$2,150/mo" },
            { label: "Refinancing Opportunities", value: "$186/mo saving" },
          ],
        },
      ],
    },
    {
      id: "credit-cards",
      side: "liability",
      label: "Credit Cards",
      value: 8477,
      monthlyChange: -540,
      accountCount: 3,
      status: "Good",
      statusTone: "good",
      healthIndicator: { label: "Utilisation", status: "Good" },
      trend: { period: "Monthly", value: -540, label: "-$540 this month" },
      primaryMetric: { label: "Outstanding", value: "$8,477" },
      secondaryMetric: { label: "Utilisation", value: "18%" },
      aiInsight: "Credit utilisation is controlled, but clearing statement balances preserves borrowing capacity.",
      source: { label: "Bank Statement", updatedAt },
      accounts: [
        {
          id: "card-amex",
          name: "Amex Platinum",
          value: 3650,
          source: { label: "Bank Statement", updatedAt },
          details: [
            { label: "Balance", value: "$3,650" },
            { label: "Interest Rate", value: "20.74%" },
            { label: "Repayments", value: "$720 due" },
          ],
        },
        {
          id: "card-visa",
          name: "Visa Rewards",
          value: 4827,
          source: { label: "Bank Statement", updatedAt },
          details: [
            { label: "Balance", value: "$4,827" },
            { label: "Interest Rate", value: "19.99%" },
            { label: "Repayments", value: "$1,100 due" },
          ],
        },
      ],
    },
    {
      id: "personal-car-loans",
      side: "liability",
      label: "Personal / Car Loans",
      value: 14200,
      monthlyChange: -620,
      accountCount: 1,
      status: "Manageable",
      statusTone: "moderate",
      healthIndicator: { label: "Debt Load", status: "Moderate" },
      trend: { period: "Monthly", value: -620, label: "$620 repayment" },
      primaryMetric: { label: "Interest Rate", value: "8.1%" },
      secondaryMetric: { label: "Monthly Repayment", value: "$620" },
      aiInsight: "Reducing this loan would lift monthly surplus and borrowing capacity.",
      source: { label: "Manual Entry", updatedAt },
      accounts: [
        {
          id: "loan-car",
          name: "Car Loan",
          value: 14200,
          source: { label: "Manual Entry", updatedAt },
          details: [
            { label: "Balance", value: "$14,200" },
            { label: "Interest Rate", value: "8.1%" },
            { label: "Repayments", value: "$620/mo" },
          ],
        },
      ],
    },
    {
      id: "other-debt",
      side: "liability",
      label: "Other Debt",
      value: 0,
      monthlyChange: 0,
      accountCount: 0,
      status: "Clear",
      statusTone: "excellent",
      healthIndicator: { label: "Other Debt", status: "Excellent" },
      trend: { period: "Monthly", value: 0, label: "No active debt" },
      primaryMetric: { label: "Outstanding", value: "$0" },
      aiInsight: "No other debt is recorded, which supports clean serviceability.",
      source: { label: "Manual Entry", updatedAt },
      accounts: [],
    },
  ];

  const assetsTotal = sum(assets);
  const liabilitiesTotal = sum(liabilities);

  return {
    asOf: updatedAt,
    assetsTotal,
    liabilitiesTotal,
    netWorth: assetsTotal - liabilitiesTotal,
    monthlyNetChange: 11810,
    emergencyFundMonths: 4.2,
    currentDeposit: 27860,
    availableEquity: 720000,
    borrowingCapacity: 812000,
    houseReadinessScore: 78,
    refinance: {
      monthlySaving: 186,
      annualSaving: 2232,
      confidence: "High",
    },
    assets,
    liabilities,
  };
}

export function getFinancialBalanceSheetCategory(id: string) {
  const sheet = getFinancialBalanceSheet();
  return [...sheet.assets, ...sheet.liabilities].find((category) => category.id === id) ?? null;
}

export function getFinancialBalanceSheetCategoryIds() {
  return [...getFinancialBalanceSheet().assets, ...getFinancialBalanceSheet().liabilities].map((category) => category.id);
}
import type { FinancialPositionReadModel } from "@/server/services/financialPositionReadService";

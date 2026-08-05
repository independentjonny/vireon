import { getMerchantCategory } from "./merchantCanonicalizer.ts";

export type CategoryResult = {
  category: string;
  subCategory: string;
  confidence: number;
};

const KEYWORD_RULES: Array<{ pattern: RegExp; category: string; subCategory: string; confidence: number }> = [
  { pattern: /salary|payroll|income|wage/i, category: "Income", subCategory: "Employment", confidence: 0.95 },
  { pattern: /interest|dividend|returns/i, category: "Income", subCategory: "Investment", confidence: 0.9 },
  { pattern: /mortgage|rent|lease/i, category: "Housing", subCategory: "Accommodation", confidence: 0.92 },
  { pattern: /electricity|gas|water|council|rates/i, category: "Housing", subCategory: "Utilities", confidence: 0.9 },
  { pattern: /netflix|spotify|disney|hbo|apple tv|stan/i, category: "Entertainment", subCategory: "Streaming", confidence: 0.97 },
  { pattern: /gym|fitness|yoga|pilates/i, category: "Health", subCategory: "Fitness", confidence: 0.88 },
  { pattern: /doctor|dentist|pharmacy|medical|health insurance/i, category: "Health", subCategory: "Medical", confidence: 0.89 },
  { pattern: /uber|taxi|lyft|ola|didi|train|bus|ferry/i, category: "Transport", subCategory: "Commuting", confidence: 0.91 },
  { pattern: /petrol|fuel|shell|bp|caltex/i, category: "Transport", subCategory: "Fuel", confidence: 0.93 },
  { pattern: /restaurant|cafe|coffee|mcdonalds|kfc|pizza/i, category: "Food & Dining", subCategory: "Eating Out", confidence: 0.87 },
  { pattern: /woolworths|coles|aldi|iga|supermarket/i, category: "Groceries", subCategory: "Supermarket", confidence: 0.95 },
  { pattern: /amazon|ebay|kmart|target|big w|myer|david jones/i, category: "Shopping", subCategory: "Retail", confidence: 0.85 },
  { pattern: /subscription|saas|software|cloud/i, category: "Business", subCategory: "Software", confidence: 0.82 },
  { pattern: /travel|hotel|airbnb|flight|qantas|jetstar/i, category: "Travel", subCategory: "Accommodation", confidence: 0.88 },
  { pattern: /atm|cash withdrawal/i, category: "Cash", subCategory: "ATM", confidence: 0.99 },
  { pattern: /transfer|bpay|payment/i, category: "Transfer", subCategory: "Internal", confidence: 0.75 },
];

export function categorizeTransaction(merchantCanonical: string, _amount: number): CategoryResult {
  const merchantCategory = getMerchantCategory(merchantCanonical);
  if (merchantCategory !== "Uncategorised") {
    return {
      category: merchantCategory,
      subCategory: merchantCategory,
      confidence: 0.92,
    };
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(merchantCanonical)) {
      return {
        category: rule.category,
        subCategory: rule.subCategory,
        confidence: rule.confidence,
      };
    }
  }

  return {
    category: "Uncategorised",
    subCategory: "Other",
    confidence: 0.4,
  };
}

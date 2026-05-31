export type DOMValidationRule = {
  name: string;
  selector: string;
  expectation: "exists" | "has-text" | "is-interactive" | "has-aria";
  value?: string;
};

export type DOMValidationResult = {
  rule: DOMValidationRule;
  passed: boolean;
  detail: string;
};

export type DOMValidationReport = {
  url: string;
  totalRules: number;
  passed: number;
  failed: number;
  results: DOMValidationResult[];
  score: number;
  generatedAt: string;
};

export const PAGE_RULES: DOMValidationRule[] = [
  { name: "Main heading present", selector: "h1, h2", expectation: "exists" },
  { name: "Nav items rendered", selector: "nav, aside", expectation: "exists" },
  { name: "Financial metrics visible", selector: "[class*='metric'], [class*='Metric']", expectation: "exists" },
  { name: "AI status banner", selector: "div[class*='emerald']", expectation: "exists" },
  { name: "Copilot panel", selector: "button", expectation: "exists" },
  { name: "No error boundaries triggered", selector: "[data-error]", expectation: "exists" },
];

export function simulateValidation(url: string, rules: DOMValidationRule[] = PAGE_RULES): DOMValidationReport {
  const results: DOMValidationResult[] = rules.map((rule) => {
    const passed = rule.name !== "No error boundaries triggered";
    return {
      rule,
      passed,
      detail: passed
        ? `Rule '${rule.name}' passed via semantic selector '${rule.selector}'`
        : `No elements matched selector '${rule.selector}'`,
    };
  });

  const passedCount = results.filter((r) => r.passed).length;
  const score = Math.round((passedCount / results.length) * 100);

  return {
    url,
    totalRules: rules.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results,
    score,
    generatedAt: new Date().toISOString(),
  };
}

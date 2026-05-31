export function browserValidationPlan() {
  return {
    target: "http://localhost:3000",
    checks: [
      "page loads",
      "no visible crash",
      "key API routes return 200",
      "dashboard renders",
      "screenshot captured by future browser runner",
    ],
  };
}

export function selfRepairPlan(error?: string) {
  return {
    ok: true,
    error: error || null,
    strategy: [
      "Analyse failing route or component",
      "Identify affected file set",
      "Create safe patch",
      "Run build validation",
      "Rollback if build fails",
      "Retry with corrected patch",
    ],
  };
}

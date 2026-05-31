export function autonomousRepairLoop(error?: string) {
  return {
    ok: true,
    error: error || null,
    loop: [
      "capture failure",
      "classify error",
      "select impacted files",
      "apply safe patch",
      "run build",
      "rollback if failed",
      "retry",
    ],
  };
}

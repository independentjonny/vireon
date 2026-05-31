export type DiffVerificationResult = {
  ok: boolean;
  intendedFilesChanged: string[];
  unrelatedFilesChanged: string[];
  uiTextChanged: boolean;
  domChanged: boolean;
  warnings: string[];
};

export type DiffVerificationInput = {
  changedFiles: string[];
  intendedFiles: string[];
  allowedPrefixes?: string[];
  uiTextBefore?: string;
  uiTextAfter?: string;
};

export function verifySemanticDiff(input: DiffVerificationInput): DiffVerificationResult {
  const {
    changedFiles,
    intendedFiles,
    allowedPrefixes = ["src/", ".ai/"],
    uiTextBefore,
    uiTextAfter,
  } = input;

  const intendedSet = new Set(intendedFiles);

  const intendedFilesChanged = changedFiles.filter((f) => intendedSet.has(f));
  const unrelatedFilesChanged = changedFiles.filter((f) => {
    if (intendedSet.has(f)) return false;
    const isAllowed = allowedPrefixes.some((prefix) => f.startsWith(prefix));
    return !isAllowed;
  });

  const uiTextChanged =
    uiTextBefore !== undefined && uiTextAfter !== undefined
      ? uiTextBefore !== uiTextAfter
      : false;

  const domChanged = uiTextChanged;

  const warnings: string[] = [];
  if (unrelatedFilesChanged.length > 0) {
    warnings.push(`Unrelated files changed: ${unrelatedFilesChanged.join(", ")}`);
  }
  if (intendedFiles.length > 0 && intendedFilesChanged.length === 0) {
    warnings.push("No intended files were changed");
  }

  return {
    ok: unrelatedFilesChanged.length === 0 && warnings.length === 0,
    intendedFilesChanged,
    unrelatedFilesChanged,
    uiTextChanged,
    domChanged,
    warnings,
  };
}

export function buildDiffVerificationSummary(result: DiffVerificationResult): string {
  const lines = [
    `Diff OK: ${result.ok}`,
    `Intended files changed: ${result.intendedFilesChanged.length}`,
    `Unrelated files changed: ${result.unrelatedFilesChanged.length}`,
    `UI text changed: ${result.uiTextChanged}`,
    `DOM changed: ${result.domChanged}`,
  ];
  if (result.warnings.length > 0) {
    lines.push(`Warnings: ${result.warnings.join("; ")}`);
  }
  return lines.join(" | ");
}

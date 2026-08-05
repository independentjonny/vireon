import { lintPromptCandidates } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = lintPromptCandidates();
console.log(JSON.stringify({
  artifact: path,
  candidates: report.candidates.map((candidate) => candidate.promptId),
  checkCount: report.checks.length,
  passed: report.passed,
  failures: report.checks.filter((check) => !check.passed),
}, null, 2));
if (!report.passed) process.exitCode = 1;

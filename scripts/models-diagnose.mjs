import { diagnoseModelOrchestrator } from "../src/lib/modelOrchestrator/index.ts";
import { buildLiveEvaluationPreflight } from "../src/lib/modelEvaluation/livePilot.ts";

const report = diagnoseModelOrchestrator(process.env);
const liveEvaluation = await buildLiveEvaluationPreflight(process.env);
console.log(JSON.stringify({ ...report, liveEvaluation }, null, 2));
process.exitCode = 0;

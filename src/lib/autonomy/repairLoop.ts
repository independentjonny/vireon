import { classifyRepair } from "../repairClassifier";

export function repairLoop(error: string) {
  const classification = classifyRepair(error);

  return {
    error,
    classification,
    steps: classification.repairStrategy,
    affectedLayer: classification.affectedLayer,
    errorClass: classification.class,
    confidence: classification.confidence,
  };
}

export type PropertyWorkflowState = "new" | "confirmed" | "edited";

export type PropertyWorkflowPresentation = {
  state: PropertyWorkflowState;
  steps: readonly [string, string, string];
  completedSteps: readonly [boolean, boolean, boolean];
  primaryAction: "Review details" | "View confirmed summary" | "Review changes";
  recordStatus: "In progress" | "Confirmed" | "Unsaved changes";
};

export function propertyWorkflowState(editingExisting: boolean, hasPendingChanges: boolean): PropertyWorkflowState {
  if (!editingExisting) return "new";
  return hasPendingChanges ? "edited" : "confirmed";
}

export function propertyWorkflowPresentation(state: PropertyWorkflowState): PropertyWorkflowPresentation {
  if (state === "confirmed") {
    return {
      state,
      steps: ["Saved record", "Details & evidence", "Confirmed summary"],
      completedSteps: [true, true, true],
      primaryAction: "View confirmed summary",
      recordStatus: "Confirmed",
    };
  }
  if (state === "edited") {
    return {
      state,
      steps: ["Saved record", "Edit details & evidence", "Review changes"],
      completedSteps: [true, false, false],
      primaryAction: "Review changes",
      recordStatus: "Unsaved changes",
    };
  }
  return {
    state,
    steps: ["Choose information", "Add details & evidence", "Review & confirm"],
    completedSteps: [false, false, false],
    primaryAction: "Review details",
    recordStatus: "In progress",
  };
}

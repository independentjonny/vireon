import { commandPolicy } from "@/lib/autonomy/policyEngine";
import { browserValidationPlan } from "@/lib/autonomy/browserValidator";

export async function GET() {
  return Response.json({
    ok: true,
    autonomy: {
      claudeTaskInbox: ".ai/tasks/current-task.md",
      claudeReport: ".ai/claude-report.json",
      policy: commandPolicy(),
      browserValidation: browserValidationPlan(),
    },
  });
}

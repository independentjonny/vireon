import {
  getActiveRun,
  getQueueSummary,
  detectStaleRun,
  getAutonomousHealth,
  getRunQueue,
} from "@/lib/daemonRuntime";
import { deploymentReadiness } from "@/lib/deploymentAgent";

export async function GET() {
  return Response.json({
    ok: true,
    activeRun: getActiveRun(),
    queueSummary: getQueueSummary(),
    recentRuns: getRunQueue().slice(-5),
    staleDetection: detectStaleRun(),
    autonomousHealth: getAutonomousHealth(),
    deploymentReadiness: deploymentReadiness(),
    generatedAt: new Date().toISOString(),
  });
}

import { dbStatus } from "@/lib/db";
import { authStatus } from "@/lib/auth";
import { cloudDeploymentReadiness } from "@/lib/cloudDeployment";
import { mobileShellStatus } from "@/lib/mobileShell";

export async function GET() {
  return Response.json({
    ok: true,
    phase: "Big Pass 6",
    platform: {
      database: dbStatus,
      auth: authStatus,
      cloud: cloudDeploymentReadiness(),
      mobile: mobileShellStatus(),
    },
  });
}

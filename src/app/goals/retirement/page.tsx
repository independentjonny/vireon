import AppShell from "@/app/components/AppShell";
import TrajectorySettingsClient from "@/app/components/TrajectorySettingsClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
export const dynamic="force-dynamic";
export default async function Page(){await requireServerPageSession("/goals/retirement");return <AppShell active="workspace"><TrajectorySettingsClient /></AppShell>;}

import { getGitState } from "@/lib/runtimeControl";

export async function GET() {
  const state = getGitState();
  const isGitRepo = state.branch !== null || state.lastCommit !== null;
  return Response.json({ ok: isGitRepo, isGitRepo, ...state });
}

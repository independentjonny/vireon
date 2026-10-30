import type { AiDecisionStatus } from "./aiDecisionCentre";

export type StoredDecisionState = {
  status: AiDecisionStatus;
  clickedAt?: string;
  actionedAt?: string;
};

export async function saveDecisionStatus(id: string, status: AiDecisionStatus, fetchImpl: typeof fetch = fetch): Promise<Record<string, StoredDecisionState>> {
  try {
    const response = await fetchImpl("/api/decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decisionId: id, status }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json() as { states?: Record<string, StoredDecisionState> };
    if (!response.ok || !data.states || Array.isArray(data.states) || data.states[id]?.status !== status) throw new Error("Not acknowledged");
    return data.states;
  } catch {
    throw new Error("Could not confirm the saved decision status. Your displayed status is unchanged. Try again or reload to check the latest saved status.");
  }
}

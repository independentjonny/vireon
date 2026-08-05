import { randomUUID } from "node:crypto";
import type { Session } from "@/lib/auth/middleware";
import type { BetaOnboardingState, BetaOnboardingStepId, OnboardingStepStatus } from "@/lib/privateBetaFoundation";
import { PrivateBetaFoundation } from "@/lib/privateBetaFoundation";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import { classifyDatabaseError, createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient } from "@/server/db/postgresRuntime";

if (typeof window !== "undefined") throw new Error("Private beta onboarding PostgreSQL service is server-only.");

const SOURCE = "private-beta-onboarding-postgres";

type OnboardingRow = {
  id: string;
  userId: string;
  householdId: string;
  version: BetaOnboardingState["version"];
  steps: BetaOnboardingState["steps"];
  currentStep: BetaOnboardingStepId;
  consent: BetaOnboardingState["consent"];
  missingInformation: string[];
  updatedAt: string;
};

export class PrivateBetaOnboardingError extends Error {
  public readonly code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED";
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(
    code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED",
    message: string,
    status: number,
    retryable = false,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function safeError(error: unknown): PrivateBetaOnboardingError {
  if (error instanceof PrivateBetaOnboardingError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid runtime postgresql configuration|missing runtime application database url|missing runtime application role password/i.test(message)) {
    return new PrivateBetaOnboardingError("DATABASE_UNAVAILABLE", "PostgreSQL onboarding persistence is unavailable. No local fallback was used.", 503, true);
  }
  const kind = classifyDatabaseError(error);
  if (kind === "CONNECTION" || kind === "QUERY_TIMEOUT") {
    return new PrivateBetaOnboardingError("DATABASE_UNAVAILABLE", "PostgreSQL onboarding persistence is unavailable. No local fallback was used.", 503, true);
  }
  return new PrivateBetaOnboardingError("VALIDATION_FAILED", "The onboarding state could not be persisted.", 422);
}

function mapRow(row: OnboardingRow): BetaOnboardingState {
  return {
    id: row.id,
    userId: row.userId,
    householdId: row.householdId,
    version: row.version,
    steps: row.steps,
    currentStep: row.currentStep,
    consent: row.consent,
    missingInformation: row.missingInformation,
    updatedAt: row.updatedAt,
  };
}

export function createPrivateBetaOnboardingServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return createPrivateBetaOnboardingPostgresService(new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv(env)));
}

export function createPrivateBetaOnboardingPostgresService(client: PostgresPilotClient) {
  async function scoped<T>(session: Session, operation: (tx: PostgresPilotClient, userId: string) => Promise<T>): Promise<T> {
    if (!session.userId) throw new PrivateBetaOnboardingError("UNAUTHENTICATED", "Sign in is required.", 401);
    try {
      return await client.transaction(async (tx) => {
        await tx.query("select set_config('app.current_user_id', $1, true)", [session.userId]);
        return operation(tx, session.userId);
      });
    } catch (error) {
      throw safeError(error);
    }
  }

  async function selectCurrent(tx: PostgresPilotClient, userId: string): Promise<BetaOnboardingState | null> {
    const result = await tx.query<OnboardingRow>(
      `select id, user_id as "userId", household_id as "householdId", version, steps,
              current_step as "currentStep", consent, missing_information as "missingInformation",
              updated_at as "updatedAt"
         from private_beta_onboarding
        where user_id = $1
        order by updated_at desc
        limit 1`,
      [userId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async function insertDefault(tx: PostgresPilotClient, userId: string): Promise<BetaOnboardingState> {
    const state = PrivateBetaFoundation.defaultOnboardingState(userId, userId);
    const result = await tx.query<OnboardingRow>(
      `insert into private_beta_onboarding
         (id, user_id, household_id, version, steps, current_step, consent, missing_information, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, now())
       on conflict (id) do update set updated_at = private_beta_onboarding.updated_at
       returning id, user_id as "userId", household_id as "householdId", version, steps,
                 current_step as "currentStep", consent, missing_information as "missingInformation",
                 updated_at as "updatedAt"`,
      [state.id, userId, userId, state.version, JSON.stringify(state.steps), state.currentStep, JSON.stringify(state.consent), JSON.stringify(state.missingInformation)],
    );
    await tx.query(
      `insert into audit_events(user_id, actor, action, entity_type, entity_id, before_hash, after_hash, reason, request_id, source, correlation_id)
       values ($1, 'user', 'private_beta.onboarding_started', 'private_beta_onboarding', $2, null, null, 'onboarding initialized', $3, $4, $5)`,
      [userId, state.id, randomUUID(), SOURCE, randomUUID()],
    );
    return mapRow(result.rows[0]);
  }

  return {
    toSafeError: safeError,
    async readOrCreate(session: Session): Promise<BetaOnboardingState> {
      return scoped(session, async (tx, userId) => (await selectCurrent(tx, userId)) ?? insertDefault(tx, userId));
    },
    async update(session: Session, input: { step: BetaOnboardingStepId; status: OnboardingStepStatus; consent?: Partial<BetaOnboardingState["consent"]> }): Promise<BetaOnboardingState> {
      return scoped(session, async (tx, userId) => {
        const current = (await selectCurrent(tx, userId)) ?? (await insertDefault(tx, userId));
        const next = PrivateBetaFoundation.updateOnboardingState(current, input);
        const result = await tx.query<OnboardingRow>(
          `update private_beta_onboarding
              set steps = $3::jsonb, current_step = $4, consent = $5::jsonb,
                  missing_information = $6::jsonb, updated_at = now()
            where id = $1 and user_id = $2
            returning id, user_id as "userId", household_id as "householdId", version, steps,
                      current_step as "currentStep", consent, missing_information as "missingInformation",
                      updated_at as "updatedAt"`,
          [current.id, userId, JSON.stringify(next.steps), next.currentStep, JSON.stringify(next.consent), JSON.stringify(next.missingInformation)],
        );
        if (!result.rows[0]) throw new PrivateBetaOnboardingError("VALIDATION_FAILED", "The onboarding state could not be persisted.", 422);
        await tx.query(
          `insert into audit_events(user_id, actor, action, entity_type, entity_id, before_hash, after_hash, reason, request_id, source, correlation_id)
           values ($1, 'user', 'private_beta.onboarding_updated', 'private_beta_onboarding', $2, null, null, $3, $4, $5, $6)`,
          [userId, current.id, `step:${input.step};status:${input.status}`, randomUUID(), SOURCE, randomUUID()],
        );
        return mapRow(result.rows[0]);
      });
    },
  };
}

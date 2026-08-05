import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { gatherAICfoInputs } from "@/lib/aiCfoRuntime";
import type { AICfoInputs } from "@/lib/aiCfo";
import {
  DailyReviewEngine,
  DEFAULT_DAILY_REVIEW_SETTINGS,
  type DailyFinancialReview,
  type DailyReviewEngineInput,
  type DailyReviewHistoryRecord,
  type DailyReviewSettings,
} from "@/lib/aiCfoDailyReview";

export type DailyReviewPersistedState = {
  settings: DailyReviewSettings;
  reviews: DailyFinancialReview[];
  history: DailyReviewHistoryRecord[];
  lastSuccessfulReviewAt: string | null;
};

const DATA_DIR = join(process.cwd(), ".ai", "local-data");
const DAILY_REVIEW_FILE = "ai-cfo-daily-review.json";

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(): string {
  if (process.env.VIREON_DAILY_REVIEW_STORE_FILE) return process.env.VIREON_DAILY_REVIEW_STORE_FILE;
  ensureDataDir();
  return join(DATA_DIR, DAILY_REVIEW_FILE);
}

function emptyState(): DailyReviewPersistedState {
  return {
    settings: DEFAULT_DAILY_REVIEW_SETTINGS,
    reviews: [],
    history: [],
    lastSuccessfulReviewAt: null,
  };
}

export function getDailyReviewState(): DailyReviewPersistedState {
  const path = filePath();
  if (!existsSync(path)) {
    const state = emptyState();
    writeDailyReviewState(state);
    return state;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<DailyReviewPersistedState>;
    return {
      settings: { ...DEFAULT_DAILY_REVIEW_SETTINGS, ...parsed.settings },
      reviews: parsed.reviews ?? [],
      history: parsed.history ?? [],
      lastSuccessfulReviewAt: parsed.lastSuccessfulReviewAt ?? null,
    };
  } catch {
    const state = emptyState();
    writeDailyReviewState(state);
    return state;
  }
}

export function writeDailyReviewState(state: DailyReviewPersistedState): void {
  writeFileSync(filePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function updateDailyReviewSettings(settings: Partial<DailyReviewSettings>): DailyReviewPersistedState {
  const current = getDailyReviewState();
  const next: DailyReviewPersistedState = {
    ...current,
    settings: {
      ...current.settings,
      ...settings,
      quiet: { ...current.settings.quiet, ...settings.quiet },
      thresholds: { ...current.settings.thresholds, ...settings.thresholds },
    },
  };
  writeDailyReviewState(next);
  return next;
}

export function persistDailyReviewHistory(record: DailyReviewHistoryRecord): DailyReviewPersistedState {
  const current = getDailyReviewState();
  const next: DailyReviewPersistedState = {
    ...current,
    reviews: [record.review, ...current.reviews.filter((review) => review.id !== record.review.id)].slice(0, 120),
    history: [record, ...current.history.filter((item) => item.review.id !== record.review.id)].slice(0, 120),
    lastSuccessfulReviewAt: record.review.status === "Failed Safely" ? current.lastSuccessfulReviewAt : record.review.createdAt,
  };
  writeDailyReviewState(next);
  return next;
}

export function runAndPersistDailyReview(input: Omit<DailyReviewEngineInput, "inputs" | "settings"> & { settings?: Partial<DailyReviewSettings>; inputs?: AICfoInputs } = {}): { record: DailyReviewHistoryRecord; state: DailyReviewPersistedState } {
  const current = existsSync(filePath()) ? getDailyReviewState() : emptyState();
  const record = DailyReviewEngine.run({
    ...input,
    inputs: input.inputs ?? gatherAICfoInputs(),
    settings: input.settings ?? current.settings,
  });
  return { record, state: persistDailyReviewHistory(record) };
}

export function getLatestDailyReview(inputs?: AICfoInputs): DailyReviewHistoryRecord {
  const state = getDailyReviewState();
  if (state.history[0]) return state.history[0];
  return runAndPersistDailyReview({ mode: "live", inputs }).record;
}

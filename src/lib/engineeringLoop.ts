export type TaskQueueItem = {
  id: string;
  goal: string;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "in_progress" | "complete" | "failed" | "max_attempts_reached";
  createdAt: string;
  completedAt?: string;
  lastError?: string;
};

export type LoopState = {
  running: boolean;
  queue: TaskQueueItem[];
  completedCount: number;
  failedCount: number;
  startedAt: string;
};

const MAX_ATTEMPTS_DEFAULT = 3;

export function createTaskQueue(goals: string[]): TaskQueueItem[] {
  return goals.map((goal, i) => ({
    id: `task-${Date.now()}-${i}`,
    goal,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS_DEFAULT,
    status: "pending",
    createdAt: new Date().toISOString(),
  }));
}

export function processNextTask(state: LoopState): {
  state: LoopState;
  task: TaskQueueItem | null;
  action: "run" | "skip" | "idle";
} {
  const pending = state.queue.find((t) => t.status === "pending");
  if (!pending) {
    return { state, task: null, action: "idle" };
  }

  if (pending.attempts >= pending.maxAttempts) {
    const updated = {
      ...pending,
      status: "max_attempts_reached" as const,
    };
    return {
      state: {
        ...state,
        queue: state.queue.map((t) => (t.id === pending.id ? updated : t)),
        failedCount: state.failedCount + 1,
      },
      task: updated,
      action: "skip",
    };
  }

  const inProgress = {
    ...pending,
    status: "in_progress" as const,
    attempts: pending.attempts + 1,
  };

  return {
    state: {
      ...state,
      queue: state.queue.map((t) => (t.id === pending.id ? inProgress : t)),
    },
    task: inProgress,
    action: "run",
  };
}

export function completeTask(state: LoopState, taskId: string, error?: string): LoopState {
  const succeeded = !error;
  return {
    ...state,
    queue: state.queue.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        status: succeeded ? "complete" : "pending",
        completedAt: succeeded ? new Date().toISOString() : undefined,
        lastError: error,
      };
    }),
    completedCount: succeeded ? state.completedCount + 1 : state.completedCount,
  };
}

export function loopStatus(state: LoopState): {
  pending: number;
  inProgress: number;
  complete: number;
  failed: number;
  total: number;
} {
  return {
    pending: state.queue.filter((t) => t.status === "pending").length,
    inProgress: state.queue.filter((t) => t.status === "in_progress").length,
    complete: state.queue.filter((t) => t.status === "complete").length,
    failed: state.queue.filter((t) =>
      ["failed", "max_attempts_reached"].includes(t.status)
    ).length,
    total: state.queue.length,
  };
}

export function initialLoopState(goals: string[] = []): LoopState {
  return {
    running: false,
    queue: createTaskQueue(goals),
    completedCount: 0,
    failedCount: 0,
    startedAt: new Date().toISOString(),
  };
}

import * as fs from "fs";
import * as path from "path";

const AI_DIR = path.join(process.cwd(), ".ai");
const QUEUE_FILE = path.join(AI_DIR, "builds", "queue.json");

export type BuildJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface BuildJob {
  jobId: string;
  goal: string;
  status: BuildJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stages: string[];
  result?: { passed: boolean; note: string };
}

export interface BuildQueue {
  updatedAt: string;
  jobs: BuildJob[];
}

function ensureQueueFile(): void {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(QUEUE_FILE)) {
    const initial: BuildQueue = { updatedAt: new Date().toISOString(), jobs: [] };
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(initial, null, 2), "utf-8");
  }
}

function readQueue(): BuildQueue {
  ensureQueueFile();
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8")) as BuildQueue;
  } catch {
    return { updatedAt: new Date().toISOString(), jobs: [] };
  }
}

function writeQueue(queue: BuildQueue): void {
  ensureQueueFile();
  queue.updatedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf-8");
}

export function addBuildJob(
  goal: string,
  stages: string[] = ["typecheck", "build", "test", "browser"]
): BuildJob {
  const queue = readQueue();
  const job: BuildJob = {
    jobId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    goal,
    status: "queued",
    createdAt: new Date().toISOString(),
    stages,
  };
  queue.jobs.push(job);
  writeQueue(queue);
  return job;
}

export function listBuildJobs(): BuildQueue {
  return readQueue();
}

export function getNextQueuedJob(): BuildJob | null {
  const queue = readQueue();
  return queue.jobs.find((j) => j.status === "queued") ?? null;
}

export function startBuildJob(jobId: string): BuildJob | null {
  const queue = readQueue();
  const job = queue.jobs.find((j) => j.jobId === jobId);
  if (!job) return null;
  job.status = "running";
  job.startedAt = new Date().toISOString();
  writeQueue(queue);
  return job;
}

export function completeBuildJob(
  jobId: string,
  passed: boolean,
  note: string
): BuildJob | null {
  const queue = readQueue();
  const job = queue.jobs.find((j) => j.jobId === jobId);
  if (!job) return null;
  job.status = passed ? "succeeded" : "failed";
  job.completedAt = new Date().toISOString();
  job.result = { passed, note };
  writeQueue(queue);
  return job;
}

import * as fs from "fs";
import * as path from "path";

const LOG_FILE = path.join(process.cwd(), ".ai", "operations", "logs", "app.json");

interface LogEntry {
  source: "npm" | "nextjs" | "app";
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp?: string;
  context?: Record<string, unknown>;
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const entries: LogEntry[] = Array.isArray(body.entries)
    ? (body.entries as LogEntry[])
    : body.entry
    ? [body.entry as LogEntry]
    : [];

  if (entries.length === 0) {
    return Response.json({ ok: false, error: "No log entries provided — send { entries: LogEntry[] } or { entry: LogEntry }" }, { status: 400 });
  }

  let existing: LogEntry[] = [];
  try {
    if (fs.existsSync(LOG_FILE)) {
      existing = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
    }
  } catch {
    existing = [];
  }

  const stamped = entries.map((e) => ({
    ...e,
    timestamp: e.timestamp ?? new Date().toISOString(),
  }));

  const combined = [...existing, ...stamped].slice(-500);
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(combined, null, 2));

  return Response.json({ ok: true, ingested: stamped.length, total: combined.length });
}

export async function GET() {
  let entries: LogEntry[] = [];
  try {
    if (fs.existsSync(LOG_FILE)) {
      entries = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
    }
  } catch {
    entries = [];
  }

  return Response.json({
    ok: true,
    count: entries.length,
    recent: entries.slice(-50),
    logFile: ".ai/operations/logs/app.json",
  });
}

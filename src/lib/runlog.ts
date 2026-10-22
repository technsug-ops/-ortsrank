/**
 * Run logs: one JSONL line per attempt and one per task (PHASE1_PLAN 5.6),
 * plus the run summary (record integrity, valid result rate, cost) and the
 * session time drift check (5.7).
 *
 * A task links to its attempts through `attemptIds`, so every attempt's
 * cost and error stay visible on their own.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { roundUsd } from "@/lib/plan";
import {
  SESSION_DRIFT_TOLERANCE_MINUTES,
  SESSION_TIME_ZONE,
  VALID_RESULT_RATE_TARGET,
} from "@/lib/scan-defaults";

export const ATTEMPTS_FILE = "attempts.jsonl";
export const TASKS_FILE = "tasks.jsonl";

const isoDate = z.iso.datetime({ offset: true });

export const attemptOutcomes = ["ok", "api_error", "timeout", "network_error"] as const;
export const taskStatuses = ["success", "error", "cancelled"] as const;

export const attemptRecordSchema = z.object({
  attemptId: z.string().min(1),
  taskKey: z.string().min(1),
  attempt: z.number().int().positive(),
  sentAt: isoDate,
  /** Null when no response arrived (timeout, network error). */
  receivedAt: isoDate.nullable(),
  outcome: z.enum(attemptOutcomes),
  statusCode: z.number().int().nullable(),
  statusMessage: z.string().nullable(),
  /** Charged amount: provider `cost` if confirmed, else the reserved estimate. */
  costUsd: z.number().nonnegative(),
  costCertainty: z.enum(["confirmed", "uncertain"]),
  /** Relative to the run directory: raw/<taskKey>/attempt-<n>.json */
  rawPath: z.string().min(1),
});

export const taskRecordSchema = z
  .object({
    taskKey: z.string().min(1),
    ags: z.string().regex(/^\d{8}$/),
    keyword: z.string().min(1),
    sample: z.number().int().positive(),
    session: z.number().int().positive(),
    plannedAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    status: z.enum(taskStatuses),
    /** Required unless the task succeeded, e.g. "budget_exhausted". */
    reason: z.string().min(1).nullable(),
    attemptIds: z.array(z.string().min(1)),
    finalAttemptId: z.string().min(1).nullable(),
    totalCostUsd: z.number().nonnegative(),
  })
  .superRefine((t, ctx) => {
    if (t.status !== "success" && !t.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: `${t.status} task needs a reason` });
    }
    if (t.finalAttemptId !== null && !t.attemptIds.includes(t.finalAttemptId)) {
      ctx.addIssue({ code: "custom", path: ["finalAttemptId"], message: "finalAttemptId not in attemptIds" });
    }
    if (t.status === "success" && t.finalAttemptId === null) {
      ctx.addIssue({ code: "custom", path: ["finalAttemptId"], message: "success task needs finalAttemptId" });
    }
  });

export type AttemptRecord = z.infer<typeof attemptRecordSchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;

export function attemptIdFor(taskKey: string, attempt: number): string {
  return `${taskKey}-a${attempt}`;
}

/** Each attempt gets its own file; retries never overwrite earlier ones. */
export function rawPathFor(taskKey: string, attempt: number): string {
  return `raw/${taskKey}/attempt-${attempt}.json`;
}

/** Raw attempt files on disk, as run-relative paths (same form as `rawPathFor`). */
export function listRawPaths(runDir: string): string[] {
  const rawDir = join(runDir, "raw");
  if (!existsSync(rawDir)) return [];
  return readdirSync(rawDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(rawDir, d.name))
        .filter((f) => /^attempt-\d+\.json$/.test(f))
        .map((f) => `raw/${d.name}/${f}`),
    )
    .sort();
}

/** Append-only writer for one run directory. */
export class RunLog {
  constructor(readonly runDir: string) {
    mkdirSync(runDir, { recursive: true });
  }

  appendAttempt(record: AttemptRecord): void {
    appendJsonLine(join(this.runDir, ATTEMPTS_FILE), attemptRecordSchema.parse(record));
  }

  appendTask(record: TaskRecord): void {
    appendJsonLine(join(this.runDir, TASKS_FILE), taskRecordSchema.parse(record));
  }
}

function appendJsonLine(file: string, value: unknown): void {
  appendFileSync(file, `${JSON.stringify(value)}\n`, "utf8");
}

function readJsonLines<T>(file: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line, i) => [line, i + 1] as const)
    .filter(([line]) => line.trim() !== "")
    .map(([line, lineNo]) => {
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch {
        throw new Error(`${file}:${lineNo}: not valid JSON`);
      }
      const r = schema.safeParse(json);
      if (!r.success) throw new Error(`${file}:${lineNo}: ${r.error.issues.map((i) => i.message).join("; ")}`);
      return r.data;
    });
}

export function readAttempts(runDir: string): AttemptRecord[] {
  return readJsonLines(join(runDir, ATTEMPTS_FILE), attemptRecordSchema);
}

export function readTasks(runDir: string): TaskRecord[] {
  return readJsonLines(join(runDir, TASKS_FILE), taskRecordSchema);
}

// ── Summary ─────────────────────────────────────────────────────────────

export interface SummaryInput {
  plannedTaskKeys: readonly string[];
  tasks: readonly TaskRecord[];
  attempts: readonly AttemptRecord[];
  expectedUsd: number;
  worstCaseUsd: number;
  /**
   * Raw files found on disk (`listRawPaths`). A raw file without an attempt
   * record means a request was sent but not logged (e.g. the run stopped
   * between writing the response and the log line); its cost is unknown.
   */
  rawPaths?: readonly string[];
}

export interface RunSummary {
  plannedTasks: number;
  recordedTasks: number;
  /** recorded planned tasks / planned tasks; must be 1. Null if nothing planned. */
  recordIntegrity: number | null;
  /** tasks with a usable result / planned tasks; target VALID_RESULT_RATE_TARGET. */
  validResultRate: number | null;
  validResultTarget: number;
  validResults: number;
  statusCounts: Record<(typeof taskStatuses)[number], number>;
  /** Non-successful tasks counted by their reason. */
  reasons: Record<string, number>;
  attempts: number;
  cost: {
    expectedUsd: number;
    worstCaseUsd: number;
    confirmedUsd: number;
    uncertainUsd: number;
    totalUsd: number;
  };
  /** Everything that breaks record integrity; empty when the logs are complete. */
  problems: string[];
}

export function summarizeRun(input: SummaryInput): RunSummary {
  const planned = new Set(input.plannedTaskKeys);
  const attemptsById = new Map(input.attempts.map((a) => [a.attemptId, a]));
  const problems: string[] = [];

  const seen = new Set<string>();
  for (const t of input.tasks) {
    if (seen.has(t.taskKey)) problems.push(`task ${t.taskKey} recorded more than once`);
    seen.add(t.taskKey);
    if (!planned.has(t.taskKey)) problems.push(`task ${t.taskKey} was not planned`);

    const own = t.attemptIds.map((id) => attemptsById.get(id));
    t.attemptIds.forEach((id, i) => {
      const a = own[i];
      if (!a) problems.push(`task ${t.taskKey}: attempt ${id} not found`);
      else if (a.taskKey !== t.taskKey) problems.push(`task ${t.taskKey}: attempt ${id} belongs to ${a.taskKey}`);
    });
    const sum = roundUsd(own.reduce((acc, a) => acc + (a?.costUsd ?? 0), 0));
    if (roundUsd(t.totalCostUsd) !== sum) {
      problems.push(`task ${t.taskKey}: totalCostUsd ${t.totalCostUsd} ≠ sum of attempts ${sum}`);
    }
  }
  const missing = [...planned].filter((k) => !seen.has(k));
  if (missing.length) problems.push(`${missing.length} planned task(s) without a record: ${missing.join(", ")}`);

  const linked = new Set(input.tasks.flatMap((t) => t.attemptIds));
  for (const a of input.attempts) {
    if (!linked.has(a.attemptId)) problems.push(`attempt ${a.attemptId} is not linked to any task`);
  }
  const loggedRaw = new Set(input.attempts.map((a) => a.rawPath));
  for (const path of input.rawPaths ?? []) {
    if (!loggedRaw.has(path)) problems.push(`raw file ${path} has no attempt record`);
  }

  const statusCounts = { success: 0, error: 0, cancelled: 0 };
  const reasons: Record<string, number> = {};
  let validResults = 0;
  for (const t of input.tasks) {
    if (!planned.has(t.taskKey)) continue;
    statusCounts[t.status] += 1;
    if (t.status !== "success" && t.reason) reasons[t.reason] = (reasons[t.reason] ?? 0) + 1;
    const final = t.finalAttemptId ? attemptsById.get(t.finalAttemptId) : undefined;
    if (t.status === "success" && final?.outcome === "ok") validResults += 1;
  }

  const recordedPlanned = [...seen].filter((k) => planned.has(k)).length;
  const ratio = (n: number) => (planned.size === 0 ? null : n / planned.size);
  const costOf = (c: AttemptRecord["costCertainty"]) =>
    roundUsd(input.attempts.filter((a) => a.costCertainty === c).reduce((acc, a) => acc + a.costUsd, 0));
  const confirmedUsd = costOf("confirmed");
  const uncertainUsd = costOf("uncertain");

  return {
    plannedTasks: planned.size,
    recordedTasks: recordedPlanned,
    recordIntegrity: ratio(recordedPlanned),
    validResultRate: ratio(validResults),
    validResultTarget: VALID_RESULT_RATE_TARGET,
    validResults,
    statusCounts,
    reasons,
    attempts: input.attempts.length,
    cost: {
      expectedUsd: input.expectedUsd,
      worstCaseUsd: input.worstCaseUsd,
      confirmedUsd,
      uncertainUsd,
      totalUsd: roundUsd(confirmedUsd + uncertainUsd),
    },
    problems,
  };
}

// ── Session drift (PHASE1_PLAN 5.7) ─────────────────────────────────────

export interface SessionDrift {
  session: number;
  plannedAt: string;
  /** Largest gap between plannedAt and a task's first send, in minutes. */
  maxDriftMinutes: number;
  flagged: boolean;
}

function minutesOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

function plannedMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Circular distance on the 24 h clock, so 23:50 vs 00:10 is 20 minutes. */
function clockDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
}

export function sessionDrift(
  tasks: readonly TaskRecord[],
  attempts: readonly AttemptRecord[],
  options: { toleranceMinutes?: number; timeZone?: string } = {},
): SessionDrift[] {
  const tolerance = options.toleranceMinutes ?? SESSION_DRIFT_TOLERANCE_MINUTES;
  const timeZone = options.timeZone ?? SESSION_TIME_ZONE;
  const attemptsById = new Map(attempts.map((a) => [a.attemptId, a]));
  const bySession = new Map<number, SessionDrift>();

  for (const t of tasks) {
    const sent = t.attemptIds
      .map((id) => attemptsById.get(id)?.sentAt)
      .filter((s): s is string => s !== undefined)
      .sort()[0];
    const entry = bySession.get(t.session) ?? { session: t.session, plannedAt: t.plannedAt, maxDriftMinutes: 0, flagged: false };
    if (sent) {
      const drift = clockDistance(minutesOfDay(sent, timeZone), plannedMinutes(t.plannedAt));
      entry.maxDriftMinutes = Math.max(entry.maxDriftMinutes, drift);
      entry.flagged = entry.maxDriftMinutes > tolerance;
    }
    bySession.set(t.session, entry);
  }
  return [...bySession.values()].sort((a, b) => a.session - b.session);
}

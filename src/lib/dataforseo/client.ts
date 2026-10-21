/**
 * DataForSEO HTTP client for Live Advanced SERP tasks (PHASE1_PLAN 5.4).
 *
 * For every attempt: reserve budget → send → store the raw body unchanged in
 * its own file → settle budget → log the attempt → parse. Retries never
 * overwrite earlier raw files. Every planned task ends with exactly one task
 * record (success, error or cancelled), so record integrity can reach 100 %.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BudgetLedger } from "@/lib/budget";
import { parseLiveResponse, type ParseResult } from "@/lib/dataforseo/parse";
import { searchLocale } from "@/i18n/config";
import type { Project, Task } from "@/lib/plan";
import { roundUsd } from "@/lib/plan";
import { attemptIdFor, rawPathFor, type AttemptRecord, type RunLog, type TaskRecord } from "@/lib/runlog";
import {
  COORDINATE_DECIMALS,
  DATAFORSEO_LIVE_ADVANCED_URL,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_RETRY_BACKOFF_MS,
  DEVICE_OS,
} from "@/lib/scan-defaults";

export interface Credentials {
  login: string;
  password: string;
}

export interface ClientOptions {
  credentials: Credentials;
  endpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
  concurrency?: number;
  backoffMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface RunContext {
  runDir: string;
  project: Pick<Project, "device" | "depth" | "pointRadiusMm" | "targetDomains">;
  ledger: BudgetLedger;
  log: RunLog;
}

export interface TaskOutcome {
  record: TaskRecord;
  /** Parsed final response when the task succeeded. */
  parsed: Extract<ParseResult, { ok: true }> | null;
  /** Sent parameter that the provider echoed back differently. */
  parameterMismatches: string[];
  priceAboveEstimate: boolean;
}

/** The single task object sent to DataForSEO. */
export interface RequestTask {
  keyword: string;
  location_coordinate: string;
  language_code: string;
  device: string;
  os: string;
  depth: number;
}

export function buildRequestTask(task: Task, project: RunContext["project"]): RequestTask {
  const coord = (v: number) => Number(v.toFixed(COORDINATE_DECIMALS)).toString();
  return {
    keyword: task.keyword,
    location_coordinate: `${coord(task.lat)},${coord(task.lng)},${project.pointRadiusMm}`,
    language_code: searchLocale.languageCode,
    device: project.device,
    os: DEVICE_OS[project.device],
    depth: project.depth,
  };
}

/** Compares what we sent with the `data` the provider echoes (ROADMAP 6). */
export function compareEchoedParameters(sent: RequestTask, raw: unknown): string[] {
  const data = (raw as { tasks?: { data?: Record<string, unknown> }[] } | null)?.tasks?.[0]?.data;
  if (!data) return ["data: missing in response"];
  const issues: string[] = [];
  for (const key of ["keyword", "language_code", "device", "depth"] as const) {
    if (data[key] !== sent[key]) issues.push(`${key}: sent ${JSON.stringify(sent[key])}, got ${JSON.stringify(data[key])}`);
  }
  const nums = (v: unknown) => (typeof v === "string" ? v.split(",").map(Number) : []);
  const a = nums(sent.location_coordinate);
  const b = nums(data.location_coordinate);
  if (a.length !== 3 || b.length !== 3 || a.some((x, i) => Math.abs(x - b[i]) > 1e-7)) {
    issues.push(`location_coordinate: sent ${sent.location_coordinate}, got ${JSON.stringify(data.location_coordinate)}`);
  }
  return issues;
}

type Classified = {
  outcome: AttemptRecord["outcome"];
  statusCode: number | null;
  statusMessage: string | null;
  costUsd: number | null;
  retry: boolean;
  parsed: ParseResult | null;
  raw: unknown;
};

function classifyResponse(httpStatus: number, body: string, targetDomains: readonly string[]): Classified {
  let raw: unknown = null;
  try {
    raw = JSON.parse(body);
  } catch {
    // Not JSON (e.g. a gateway error page): cost unknown.
  }
  const retryHttp = httpStatus === 429 || httpStatus >= 500;
  if (httpStatus < 200 || httpStatus >= 300) {
    const cost = (raw as { cost?: unknown } | null)?.cost;
    return {
      outcome: "api_error",
      statusCode: httpStatus,
      statusMessage: `HTTP ${httpStatus}`,
      costUsd: typeof cost === "number" ? cost : null,
      retry: retryHttp,
      parsed: null,
      raw,
    };
  }
  const parsed = parseLiveResponse(raw, { targetDomains });
  if (parsed.ok) {
    return { outcome: "ok", statusCode: 20000, statusMessage: "Ok.", costUsd: parsed.costUsd, retry: false, parsed, raw };
  }
  // Provider codes 5xxxx are server-side and worth a retry; 4xxxx are not.
  const retry = parsed.level === "invalid" || (parsed.statusCode ?? 0) >= 50000;
  return {
    outcome: "api_error",
    statusCode: parsed.statusCode,
    statusMessage: parsed.statusMessage,
    costUsd: parsed.costUsd,
    retry,
    parsed,
    raw,
  };
}

function errorReason(c: Pick<Classified, "outcome" | "statusCode">): string {
  if (c.outcome !== "api_error") return c.outcome;
  return c.statusCode === null ? "api_error_invalid_response" : `api_error_${c.statusCode}`;
}

export class DataForSeoClient {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly concurrency: number;
  private readonly backoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly authHeader: string;

  constructor(options: ClientOptions) {
    const { login, password } = options.credentials;
    if (!login || !password) throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required for live requests");
    this.authHeader = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
    this.endpoint = options.endpoint ?? DATAFORSEO_LIVE_ADVANCED_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    this.backoffMs = options.backoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = options.now ?? (() => new Date());
  }

  /** Runs tasks with at most `concurrency` in flight; results keep task order. */
  async runTasks(tasks: readonly Task[], ctx: RunContext): Promise<TaskOutcome[]> {
    const results: TaskOutcome[] = new Array(tasks.length);
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await this.runTask(tasks[i], ctx);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, tasks.length) }, worker));
    return results;
  }

  async runTask(task: Task, ctx: RunContext): Promise<TaskOutcome> {
    const request = buildRequestTask(task, ctx.project);
    const attemptIds: string[] = [];
    let totalCost = 0;
    let last: Classified | null = null;
    let cancelReason: string | null = null;
    let priceAboveEstimate = false;
    const maxAttempts = 1 + this.maxRetries;

    for (let n = 1; n <= maxAttempts; n++) {
      const attemptId = attemptIdFor(task.taskKey, n);
      const reservation = ctx.ledger.reserve(attemptId);
      if (!reservation.ok) {
        cancelReason = reservation.reason;
        break;
      }

      const sentAt = this.now().toISOString();
      let receivedAt: string | null = null;
      let c: Classified;
      let rawBody: string;
      try {
        const res = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
          body: JSON.stringify([request]),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        rawBody = await res.text();
        receivedAt = this.now().toISOString();
        c = classifyResponse(res.status, rawBody, ctx.project.targetDomains);
      } catch (e) {
        const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        rawBody = `${JSON.stringify({ error: { kind: timedOut ? "timeout" : "network_error", message }, body: null }, null, 2)}\n`;
        c = {
          outcome: timedOut ? "timeout" : "network_error",
          statusCode: null,
          statusMessage: message,
          costUsd: null,
          retry: true,
          parsed: null,
          raw: null,
        };
      }

      // Raw first, unchanged, one file per attempt (CLAUDE.md principle 3).
      const rawPath = rawPathFor(task.taskKey, n);
      const rawFile = join(ctx.runDir, rawPath);
      mkdirSync(dirname(rawFile), { recursive: true });
      writeFileSync(rawFile, rawBody, { flag: "wx" });

      const settled = ctx.ledger.settle(attemptId, c.costUsd);
      priceAboveEstimate ||= settled.priceAboveEstimate;
      const charged = c.costUsd ?? ctx.ledger.snapshot().costPerAttemptUsd;
      totalCost = roundUsd(totalCost + charged);

      ctx.log.appendAttempt({
        attemptId,
        taskKey: task.taskKey,
        attempt: n,
        sentAt,
        receivedAt,
        outcome: c.outcome,
        statusCode: c.statusCode,
        statusMessage: c.statusMessage,
        costUsd: charged,
        costCertainty: c.costUsd === null ? "uncertain" : "confirmed",
        rawPath,
      });
      attemptIds.push(attemptId);
      last = c;

      if (!c.retry || priceAboveEstimate || n === maxAttempts) break;
      await this.sleep(this.backoffMs * 2 ** (n - 1));
    }

    const finalAttemptId = attemptIds.at(-1) ?? null;
    let parameterMismatches: string[] = [];
    let status: TaskRecord["status"];
    let reason: string | null = null;
    let parsed: TaskOutcome["parsed"] = null;

    if (last?.outcome === "ok" && last.parsed?.ok) {
      parameterMismatches = compareEchoedParameters(request, last.raw);
      if (parameterMismatches.length) {
        status = "error";
        reason = "parameter_mismatch";
      } else {
        status = "success";
        parsed = last.parsed;
      }
    } else if (cancelReason) {
      status = "cancelled";
      reason = cancelReason;
    } else {
      status = "error";
      reason = last ? errorReason(last) : "not_sent";
    }

    const record: TaskRecord = {
      taskKey: task.taskKey,
      ags: task.ags,
      keyword: task.keyword,
      sample: task.sample,
      session: task.session,
      plannedAt: task.plannedAt,
      status,
      reason,
      attemptIds,
      finalAttemptId,
      totalCostUsd: totalCost,
    };
    ctx.log.appendTask(record);
    return { record, parsed, parameterMismatches, priceAboveEstimate };
  }
}

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BudgetLedger } from "@/lib/budget";
import { DataForSeoClient, buildRequestTask, compareEchoedParameters, type RunContext } from "@/lib/dataforseo/client";
import type { Task } from "@/lib/plan";
import { RunLog, readAttempts, readTasks, summarizeRun } from "@/lib/runlog";
import { loadFixture, type FixtureName } from "./fixtures/load";

const LOGIN = "test-login";
const PASSWORD = "s3cret-pass";
const COST = 0.004;

// Matches the echoed `data` of the success-mixed fixture.
const project: RunContext["project"] = { device: "mobile", depth: 20, pointRadiusMm: 200, targetDomains: ["ziel-betrieb.example"] };

function makeTask(i = 0, over: Partial<Task> = {}): Task {
  const ags = String(6413000 + i).padStart(8, "0");
  return {
    taskKey: `${ags}-k1-s1`,
    ags,
    settlementName: `Gemeinde ${i}`,
    lat: 50.099557,
    lng: 8.76686,
    keyword: "Terrassenüberdachung",
    keywordType: "main",
    sample: 1,
    session: 1,
    plannedAt: "09:00",
    ...over,
  };
}

// Only the fields the tests change.
interface MutableResponse {
  status_code: number;
  status_message: string;
  cost: number;
  tasks: { cost: number; data: Record<string, unknown> }[];
}

const fixtureBody = (name: FixtureName, mutate?: (raw: MutableResponse) => void) => {
  const raw = structuredClone(loadFixture(name)) as MutableResponse;
  mutate?.(raw);
  return JSON.stringify(raw);
};
const json = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "application/json" } });
const timeoutError = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

let root: string;
let runDir: string;
let ledger: BudgetLedger;
let sleeps: number[];

function setup(maxUsd = 1) {
  ledger = BudgetLedger.open({ scanDir: join(root, "scans", "scan-1"), scanId: "scan-1", runId: "run-1", maxUsd, costPerAttemptUsd: COST });
  return { runDir, project, ledger, log: new RunLog(runDir) } satisfies RunContext;
}

function client(responder: (call: number, init: RequestInit) => Promise<Response> | Response, over = {}) {
  let call = 0;
  const calls: RequestInit[] = [];
  const c = new DataForSeoClient({
    credentials: { login: LOGIN, password: PASSWORD },
    fetch: (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return responder(++call, init);
    }) as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...over,
  });
  return { c, calls };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ortsrank-client-"));
  runDir = join(root, "run-1");
  sleeps = [];
});
afterEach(() => {
  ledger?.close();
  rmSync(root, { recursive: true, force: true });
});

describe("request building", () => {
  it("sends keyword, coordinate with point radius in mm, German, device, os and depth", () => {
    const r = buildRequestTask(makeTask(0, { lat: 50.123456789, lng: 8.1 }), project);
    expect(r).toEqual({
      keyword: "Terrassenüberdachung",
      location_coordinate: "50.1234568,8.1,200",
      language_code: "de",
      device: "mobile",
      os: "android",
      depth: 20,
    });
  });

  it("detects echoed parameters that differ from what was sent", () => {
    const sent = buildRequestTask(makeTask(), project);
    expect(compareEchoedParameters(sent, loadFixture("success-mixed"))).toEqual([]);
    const other = JSON.parse(fixtureBody("success-mixed", (r) => (r.tasks[0].data.location_coordinate = "50.1,8.7,200")));
    expect(compareEchoedParameters(sent, other)[0]).toMatch(/^location_coordinate/);
    expect(compareEchoedParameters(sent, {})).toEqual(["data: missing in response"]);
  });

  it("requires credentials", () => {
    expect(() => new DataForSeoClient({ credentials: { login: "", password: "x" } })).toThrow(/DATAFORSEO_LOGIN/);
  });
});

describe("single task", () => {
  it("success: stores the raw body unchanged, logs a confirmed attempt and returns parsed rows", async () => {
    const ctx = setup();
    const body = fixtureBody("success-mixed");
    const { c, calls } = client(() => json(body));
    const out = await c.runTask(makeTask(), ctx);

    expect(out.record).toMatchObject({ status: "success", reason: null, totalCostUsd: COST, attemptIds: ["06413000-k1-s1-a1"] });
    expect(out.parsed?.rows).toHaveLength(24);
    expect(out.parsed?.targets[0]).toMatchObject({ status: "found", organicRank: 7 });
    expect(readFileSync(join(runDir, "raw/06413000-k1-s1/attempt-1.json"), "utf8")).toBe(body);

    const [a] = readAttempts(runDir);
    expect(a).toMatchObject({ outcome: "ok", statusCode: 20000, costUsd: COST, costCertainty: "confirmed" });
    expect(readTasks(runDir)).toHaveLength(1);
    expect(ledger.snapshot()).toMatchObject({ confirmedUsd: COST, reservedUsd: 0 });

    const headers = calls[0].headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64")}`);
    expect(JSON.parse(calls[0].body as string)).toEqual([buildRequestTask(makeTask(), project)]);
  });

  it("never writes credentials to disk", async () => {
    const ctx = setup();
    const { c } = client((n) => (n === 1 ? Promise.reject(timeoutError()) : json(fixtureBody("success-mixed"))));
    await c.runTask(makeTask(), ctx);
    const files = [join(runDir, "attempts.jsonl"), join(runDir, "tasks.jsonl"), join(root, "scans/scan-1/budget.json")];
    const rawDir = join(runDir, "raw/06413000-k1-s1");
    files.push(...readdirSync(rawDir).map((f) => join(rawDir, f)));
    const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(text).not.toContain(PASSWORD);
      expect(text).not.toContain(auth);
    }
  });

  it("task-level error (status_code 40501): no retry, confirmed zero cost, error reason", async () => {
    const ctx = setup();
    const { c, calls } = client(() => json(fixtureBody("error-task")));
    const out = await c.runTask(makeTask(), ctx);
    expect(calls).toHaveLength(1);
    expect(out.record).toMatchObject({ status: "error", reason: "api_error_40501", totalCostUsd: 0 });
    expect(readAttempts(runDir)[0]).toMatchObject({ outcome: "api_error", statusCode: 40501, costCertainty: "confirmed", costUsd: 0 });
  });

  it("server error (50000) is retried with backoff; each attempt keeps its own raw file", async () => {
    const ctx = setup();
    const failing = fixtureBody("error-top-level", (r) => {
      r.status_code = 50000;
      r.status_message = "Internal Error.";
    });
    const ok = fixtureBody("success-mixed");
    const { c } = client((n) => json(n === 1 ? failing : ok));
    const out = await c.runTask(makeTask(), ctx);

    expect(out.record.status).toBe("success");
    expect(out.record.attemptIds).toEqual(["06413000-k1-s1-a1", "06413000-k1-s1-a2"]);
    expect(out.record.finalAttemptId).toBe("06413000-k1-s1-a2");
    expect(sleeps).toEqual([1000]);
    expect(readFileSync(join(runDir, "raw/06413000-k1-s1/attempt-1.json"), "utf8")).toBe(failing);
    expect(readFileSync(join(runDir, "raw/06413000-k1-s1/attempt-2.json"), "utf8")).toBe(ok);
  });

  it("timeouts are charged as uncertain, retried up to 3 attempts, then the task is an error", async () => {
    const ctx = setup();
    const { c, calls } = client(() => Promise.reject(timeoutError()));
    const out = await c.runTask(makeTask(), ctx);
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([1000, 2000]);
    expect(out.record).toMatchObject({ status: "error", reason: "timeout", totalCostUsd: 0.012 });
    expect(readAttempts(runDir).map((a) => [a.outcome, a.costCertainty, a.receivedAt])).toEqual([
      ["timeout", "uncertain", null],
      ["timeout", "uncertain", null],
      ["timeout", "uncertain", null],
    ]);
    expect(JSON.parse(readFileSync(join(runDir, "raw/06413000-k1-s1/attempt-3.json"), "utf8"))).toMatchObject({
      error: { kind: "timeout" },
      body: null,
    });
    expect(ledger.snapshot()).toMatchObject({ uncertainUsd: 0.012, confirmedUsd: 0 });
  });

  it("timeout then success: one uncertain and one confirmed attempt on the same task", async () => {
    const ctx = setup();
    const { c } = client((n) => (n === 1 ? Promise.reject(timeoutError()) : json(fixtureBody("success-mixed"))));
    const out = await c.runTask(makeTask(), ctx);
    expect(out.record).toMatchObject({ status: "success", totalCostUsd: 0.008 });
    expect(readAttempts(runDir).map((a) => a.costCertainty)).toEqual(["uncertain", "confirmed"]);
  });

  it("network errors are retried; non-JSON 502 is retried; 401 is not", async () => {
    let ctx = setup();
    let r = client((n) => (n === 1 ? Promise.reject(new TypeError("fetch failed")) : new Response("<html>Bad Gateway</html>", { status: 502 })));
    let out = await r.c.runTask(makeTask(), ctx);
    expect(r.calls).toHaveLength(3);
    expect(out.record).toMatchObject({ status: "error", reason: "api_error_502" });
    expect(readAttempts(runDir).map((a) => a.outcome)).toEqual(["network_error", "api_error", "api_error"]);
    ledger.close();

    runDir = join(root, "run-2");
    ctx = setup();
    r = client(() => json(JSON.stringify({ status_code: 40100, status_message: "Unauthorized" }), 401));
    out = await r.c.runTask(makeTask(), ctx);
    expect(r.calls).toHaveLength(1);
    expect(out.record.reason).toBe("api_error_401");
    expect(readAttempts(runDir)[0].statusMessage).toBe("HTTP 401 · 40100 Unauthorized");
  });

  it("marks a response whose echoed parameters differ as parameter_mismatch", async () => {
    const ctx = setup();
    const { c } = client(() => json(fixtureBody("success-mixed", (r) => (r.tasks[0].data.depth = 10))));
    const out = await c.runTask(makeTask(), ctx);
    expect(out.record).toMatchObject({ status: "error", reason: "parameter_mismatch" });
    expect(out.parameterMismatches).toEqual(["depth: sent 20, got 10"]);
    expect(out.parsed).toBeNull();
  });

  it("refuses to overwrite an existing raw file", async () => {
    const ctx = setup();
    const { c } = client(() => json(fixtureBody("success-mixed")));
    await c.runTask(makeTask(), ctx);
    ledger.close();
    ledger = BudgetLedger.open({ scanDir: join(root, "scans", "scan-1"), scanId: "scan-1", runId: "run-1b", maxUsd: 1, costPerAttemptUsd: COST });
    await expect(c.runTask(makeTask(), { ...ctx, ledger })).rejects.toThrow(/EEXIST/);
  });
});

describe("many tasks", () => {
  it("keeps at most `concurrency` requests in flight", async () => {
    const ctx = setup();
    let inFlight = 0;
    let max = 0;
    const body = fixtureBody("success-mixed");
    const { c } = client(
      async () => {
        inFlight++;
        max = Math.max(max, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return json(body);
      },
      { concurrency: 3 },
    );
    const out = await c.runTasks(Array.from({ length: 8 }, (_, i) => makeTask(i)), ctx);
    expect(max).toBe(3);
    expect(out.map((o) => o.record.status)).toEqual(Array(8).fill("success"));
  });

  it("budget runs out: remaining tasks are cancelled with budget_exhausted; integrity stays 100 %", async () => {
    const ctx = setup(0.012); // three attempts
    const body = fixtureBody("success-mixed");
    const { c, calls } = client(() => json(body), { concurrency: 2 });
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask(i));
    const out = await c.runTasks(tasks, ctx);

    expect(calls).toHaveLength(3);
    expect(out.map((o) => o.record.status)).toEqual(["success", "success", "success", "cancelled", "cancelled"]);
    expect(out[4].record).toMatchObject({ reason: "budget_exhausted", attemptIds: [], totalCostUsd: 0 });

    const s = summarizeRun({
      plannedTaskKeys: tasks.map((t) => t.taskKey),
      tasks: readTasks(runDir),
      attempts: readAttempts(runDir),
      expectedUsd: 0.024,
      worstCaseUsd: 0.06,
    });
    expect(s.recordIntegrity).toBe(1);
    expect(s.validResultRate).toBe(0.6);
    expect(s.reasons).toEqual({ budget_exhausted: 2 });
    expect(s.problems).toEqual([]);
    expect(ledger.snapshot()).toMatchObject({ confirmedUsd: 0.012, remainingUsd: 0, overCapUsd: 0 });
  });

  it("provider charges twice the estimate: full cost recorded, no new requests, rest cancelled, overrun reported", async () => {
    const ctx = setup(0.01);
    const body = fixtureBody("success-mixed", (r) => {
      r.cost = 0.008;
      r.tasks[0].cost = 0.008;
    });
    const { c, calls } = client(() => json(body), { concurrency: 1 });
    const tasks = Array.from({ length: 4 }, (_, i) => makeTask(i));
    const out = await c.runTasks(tasks, ctx);

    expect(calls).toHaveLength(1);
    expect(out[0]).toMatchObject({ priceAboveEstimate: true, record: { status: "success", totalCostUsd: 0.008 } });
    expect(out.slice(1).map((o) => o.record.reason)).toEqual(Array(3).fill("price_above_estimate"));

    const snap = ledger.snapshot();
    expect(snap.confirmedUsd).toBe(0.008);
    expect(snap.haltedForPrice).toBe(true);
    expect(snap.priceDeviations).toEqual([expect.objectContaining({ reservedUsd: COST, actualUsd: 0.008, deltaUsd: 0.004 })]);

    const s = summarizeRun({
      plannedTaskKeys: tasks.map((t) => t.taskKey),
      tasks: readTasks(runDir),
      attempts: readAttempts(runDir),
      expectedUsd: 0.0192,
      worstCaseUsd: 0.048,
    });
    expect(s.recordIntegrity).toBe(1);
    expect(s.cost.confirmedUsd).toBe(0.008);
    expect(s.problems).toEqual([]);
  });

  it("requests already in flight when the price jumps are still recorded in full", async () => {
    const ctx = setup(1);
    const body = fixtureBody("success-mixed", (r) => (r.tasks[0].cost = 0.008));
    const { c, calls } = client(
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return json(body);
      },
      { concurrency: 3 },
    );
    const out = await c.runTasks(Array.from({ length: 6 }, (_, i) => makeTask(i)), ctx);
    expect(calls).toHaveLength(3);
    expect(out.filter((o) => o.record.status === "success")).toHaveLength(3);
    expect(out.filter((o) => o.record.reason === "price_above_estimate")).toHaveLength(3);
    expect(ledger.snapshot().confirmedUsd).toBe(0.024);
    expect(existsSync(join(runDir, "raw/06413003-k1-s1"))).toBe(false);
  });
});

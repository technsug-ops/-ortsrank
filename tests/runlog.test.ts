import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ATTEMPTS_FILE,
  RunLog,
  TASKS_FILE,
  attemptIdFor,
  listRawPaths,
  rawPathFor,
  readAttempts,
  readTasks,
  sessionDrift,
  summarizeRun,
  type AttemptRecord,
  type TaskRecord,
} from "@/lib/runlog";

const COST = 0.004;

function attempt(taskKey: string, n: number, over: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    attemptId: attemptIdFor(taskKey, n),
    taskKey,
    attempt: n,
    sentAt: "2026-10-21T07:00:00.000Z",
    receivedAt: "2026-10-21T07:00:06.000Z",
    outcome: "ok",
    statusCode: 20000,
    statusMessage: "Ok.",
    costUsd: COST,
    costCertainty: "confirmed",
    rawPath: rawPathFor(taskKey, n),
    ...over,
  };
}

function task(taskKey: string, attempts: AttemptRecord[], over: Partial<TaskRecord> = {}): TaskRecord {
  const last = attempts.at(-1);
  return {
    taskKey,
    ags: taskKey.slice(0, 8),
    keyword: "Terrassenüberdachung",
    sample: 1,
    session: 1,
    plannedAt: "09:00",
    status: "success",
    reason: null,
    attemptIds: attempts.map((a) => a.attemptId),
    finalAttemptId: last?.attemptId ?? null,
    totalCostUsd: attempts.reduce((acc, a) => acc + a.costUsd, 0),
    ...over,
  };
}

const K1 = "06412000-k1-s1";
const K2 = "06413000-k1-s1";
const K3 = "06438001-k1-s1";

describe("attempt ids and raw paths", () => {
  it("gives every attempt its own id and raw file", () => {
    expect(attemptIdFor(K1, 1)).not.toBe(attemptIdFor(K1, 2));
    expect(rawPathFor(K1, 1)).toBe(`raw/${K1}/attempt-1.json`);
    expect(rawPathFor(K1, 2)).toBe(`raw/${K1}/attempt-2.json`);
  });
});

describe("RunLog files", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ortsrank-runlog-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("appends attempts and tasks as separate JSONL files and reads them back", () => {
    const log = new RunLog(dir);
    const a1 = attempt(K1, 1, { outcome: "timeout", receivedAt: null, statusCode: null, statusMessage: "timeout", costCertainty: "uncertain" });
    const a2 = attempt(K1, 2);
    log.appendAttempt(a1);
    log.appendAttempt(a2);
    log.appendTask(task(K1, [a1, a2]));

    expect(readAttempts(dir)).toEqual([a1, a2]);
    const [t] = readTasks(dir);
    expect(t.attemptIds).toEqual([a1.attemptId, a2.attemptId]);
    expect(t.finalAttemptId).toBe(a2.attemptId);
  });

  it("returns empty lists when nothing was written yet", () => {
    expect(readAttempts(dir)).toEqual([]);
    expect(readTasks(dir)).toEqual([]);
  });

  it("rejects invalid records before writing", () => {
    const log = new RunLog(dir);
    const a = attempt(K1, 1);
    expect(() => log.appendTask(task(K1, [a], { status: "cancelled", reason: null }))).toThrow(/needs a reason/);
    expect(() => log.appendTask(task(K1, [a], { finalAttemptId: "other" }))).toThrow(/finalAttemptId/);
    expect(() => log.appendTask(task(K1, [], { status: "success" }))).toThrow(/success task needs finalAttemptId/);
    expect(() => log.appendAttempt(attempt(K1, 0))).toThrow();
    expect(() => log.appendAttempt(attempt(K1, 1, { sentAt: "yesterday" }))).toThrow();
    expect(readTasks(dir)).toEqual([]);
  });

  it("names the file and line of a corrupt record", () => {
    writeFileSync(join(dir, TASKS_FILE), "{broken\n");
    expect(() => readTasks(dir)).toThrow(new RegExp(`${TASKS_FILE}:1: not valid JSON`));
    writeFileSync(join(dir, ATTEMPTS_FILE), `${JSON.stringify(attempt(K1, 1))}\n{"attemptId":"x"}\n`);
    expect(() => readAttempts(dir)).toThrow(new RegExp(`${ATTEMPTS_FILE}:2:`));
  });
});

describe("summarizeRun", () => {
  const costs = { expectedUsd: 0.0144, worstCaseUsd: 0.036 };

  it("reports 100 % integrity and valid results for a clean run", () => {
    const a = [attempt(K1, 1), attempt(K2, 1), attempt(K3, 1)];
    const s = summarizeRun({ plannedTaskKeys: [K1, K2, K3], tasks: a.map((x) => task(x.taskKey, [x])), attempts: a, ...costs });
    expect(s.recordIntegrity).toBe(1);
    expect(s.validResultRate).toBe(1);
    expect(s.validResultTarget).toBe(0.98);
    expect(s.statusCounts).toEqual({ success: 3, error: 0, cancelled: 0 });
    expect(s.problems).toEqual([]);
    expect(s.cost).toEqual({ ...costs, confirmedUsd: 0.012, uncertainUsd: 0, totalUsd: 0.012 });
  });

  it("flags raw files on disk that have no attempt record (request sent but not logged)", () => {
    const a = attempt(K1, 1);
    const s = summarizeRun({
      plannedTaskKeys: [K1],
      tasks: [task(K1, [a])],
      attempts: [a],
      rawPaths: [rawPathFor(K1, 1), rawPathFor(K2, 1)],
      ...costs,
    });
    expect(s.recordIntegrity).toBe(1);
    expect(s.problems).toEqual([`raw file ${rawPathFor(K2, 1)} has no attempt record`]);
  });

  it("detects planned tasks without a record", () => {
    const a = attempt(K1, 1);
    const s = summarizeRun({ plannedTaskKeys: [K1, K2, K3], tasks: [task(K1, [a])], attempts: [a], ...costs });
    expect(s.recordIntegrity).toBeCloseTo(1 / 3, 10);
    expect(s.recordedTasks).toBe(1);
    expect(s.problems.join("\n")).toMatch(new RegExp(`2 planned task\\(s\\) without a record: ${K2}, ${K3}`));
  });

  it("counts cancelled and failed tasks as recorded, by reason, but not as valid results", () => {
    const ok = attempt(K1, 1);
    const err = attempt(K2, 1, { outcome: "api_error", statusCode: 40501, statusMessage: "Invalid Field", costUsd: 0 });
    const tasks = [
      task(K1, [ok]),
      task(K2, [err], { status: "error", reason: "api_error_40501" }),
      task(K3, [], { status: "cancelled", reason: "budget_exhausted", finalAttemptId: null, totalCostUsd: 0 }),
    ];
    const s = summarizeRun({ plannedTaskKeys: [K1, K2, K3], tasks, attempts: [ok, err], ...costs });
    expect(s.recordIntegrity).toBe(1);
    expect(s.validResults).toBe(1);
    expect(s.validResultRate).toBeCloseTo(1 / 3, 10);
    expect(s.statusCounts).toEqual({ success: 1, error: 1, cancelled: 1 });
    expect(s.reasons).toEqual({ api_error_40501: 1, budget_exhausted: 1 });
    expect(s.problems).toEqual([]);
  });

  it("links several attempts of one task and sums their cost, confirmed and uncertain apart", () => {
    const timeout = attempt(K1, 1, { outcome: "timeout", receivedAt: null, statusCode: null, statusMessage: "timeout", costCertainty: "uncertain" });
    const ok = attempt(K1, 2, { costUsd: 0.004 });
    const s = summarizeRun({ plannedTaskKeys: [K1], tasks: [task(K1, [timeout, ok])], attempts: [timeout, ok], ...costs });
    expect(s.attempts).toBe(2);
    expect(s.validResults).toBe(1);
    expect(s.cost.confirmedUsd).toBe(0.004);
    expect(s.cost.uncertainUsd).toBe(0.004);
    expect(s.cost.totalUsd).toBe(0.008);
    expect(s.problems).toEqual([]);
  });

  it("total cost equals the sum of all attempts", () => {
    const a = [
      attempt(K1, 1, { costUsd: 0.004 }),
      attempt(K1, 2, { costUsd: 0.006 }),
      attempt(K2, 1, { costUsd: 0.002, costCertainty: "uncertain", outcome: "network_error", receivedAt: null }),
    ];
    const tasks = [task(K1, a.slice(0, 2)), task(K2, [a[2]], { status: "error", reason: "network_error" })];
    const s = summarizeRun({ plannedTaskKeys: [K1, K2], tasks, attempts: a, ...costs });
    expect(s.cost.totalUsd).toBe(0.012);
    expect(s.problems).toEqual([]);
  });

  it("does not count success as valid when the final attempt was not ok", () => {
    const bad = attempt(K1, 1, { outcome: "api_error", statusCode: 50000 });
    const s = summarizeRun({ plannedTaskKeys: [K1], tasks: [task(K1, [bad])], attempts: [bad], ...costs });
    expect(s.validResults).toBe(0);
  });

  it("flags cost mismatches, dangling and foreign attempts, duplicates and unplanned tasks", () => {
    const a1 = attempt(K1, 1);
    const a2 = attempt(K2, 1);
    const orphan = attempt(K3, 1);
    const tasks = [
      task(K1, [a1], { totalCostUsd: 0.001 }),
      task(K2, [a2], { attemptIds: [a2.attemptId, a1.attemptId] }),
      task(K2, [a2]),
      task("99999999-k1-s1", [], { status: "cancelled", reason: "x", finalAttemptId: null, totalCostUsd: 0 }),
      task(K3, [], { status: "error", reason: "x", attemptIds: ["missing-a1"], finalAttemptId: null, totalCostUsd: 0 }),
    ];
    const s = summarizeRun({ plannedTaskKeys: [K1, K2, K3], tasks, attempts: [a1, a2, orphan], ...costs });
    const text = s.problems.join("\n");
    expect(text).toContain(`task ${K1}: totalCostUsd 0.001 ≠ sum of attempts 0.004`);
    expect(text).toMatch(new RegExp(`attempt ${a1.attemptId} belongs to ${K1}`));
    expect(text).toMatch(new RegExp(`task ${K2} recorded more than once`));
    expect(text).toMatch(/task 99999999-k1-s1 was not planned/);
    expect(text).toMatch(/attempt missing-a1 not found/);
    expect(text).toMatch(new RegExp(`attempt ${orphan.attemptId} is not linked to any task`));
    // Unplanned tasks do not raise integrity above the planned set.
    expect(s.recordedTasks).toBe(3);
  });

  it("returns null ratios when nothing was planned", () => {
    const s = summarizeRun({ plannedTaskKeys: [], tasks: [], attempts: [], ...costs });
    expect(s.recordIntegrity).toBeNull();
    expect(s.validResultRate).toBeNull();
  });
});

describe("sessionDrift", () => {
  // 21.10.2026 is summer time in Germany (UTC+2); 01.12.2026 is winter time (UTC+1).
  function sent(taskKey: string, session: number, plannedAt: string, sentAt: string) {
    const a = attempt(taskKey, 1, { sentAt });
    return { a, t: task(taskKey, [a], { session, plannedAt }) };
  }

  it("measures drift in German local time and flags sessions beyond 60 minutes", () => {
    const rows = [
      sent(K1, 1, "09:00", "2026-10-21T07:05:00Z"), // 09:05 local → 5 min
      sent(K2, 1, "09:00", "2026-10-21T07:40:00Z"), // 09:40 → 40 min
      sent(K3, 2, "13:00", "2026-10-21T12:30:00Z"), // 14:30 → 90 min
    ];
    const d = sessionDrift(rows.map((r) => r.t), rows.map((r) => r.a));
    expect(d).toEqual([
      { session: 1, plannedAt: "09:00", maxDriftMinutes: 40, flagged: false },
      { session: 2, plannedAt: "13:00", maxDriftMinutes: 90, flagged: true },
    ]);
  });

  it("handles winter time", () => {
    const r = sent(K1, 1, "09:00", "2026-12-01T08:00:00Z"); // 09:00 CET
    expect(sessionDrift([r.t], [r.a])[0].maxDriftMinutes).toBe(0);
  });

  it("uses the first send of a task, not its retries", () => {
    const first = attempt(K1, 1, { sentAt: "2026-10-21T07:00:00Z", outcome: "timeout", receivedAt: null, costCertainty: "uncertain" });
    const retry = attempt(K1, 2, { sentAt: "2026-10-21T09:30:00Z" });
    const d = sessionDrift([task(K1, [first, retry])], [first, retry]);
    expect(d[0].maxDriftMinutes).toBe(0);
  });

  it("measures across midnight on the 24 h clock", () => {
    const r = sent(K1, 3, "23:50", "2026-10-21T22:10:00Z"); // 00:10 local
    expect(sessionDrift([r.t], [r.a])[0].maxDriftMinutes).toBe(20);
  });

  it("does not flag a session whose tasks were never sent", () => {
    const t = task(K1, [], { status: "cancelled", reason: "budget_exhausted", finalAttemptId: null, totalCostUsd: 0 });
    expect(sessionDrift([t], [])).toEqual([{ session: 1, plannedAt: "09:00", maxDriftMinutes: 0, flagged: false }]);
  });

  it("accepts a custom tolerance", () => {
    const r = sent(K1, 1, "09:00", "2026-10-21T07:30:00Z");
    expect(sessionDrift([r.t], [r.a], { toleranceMinutes: 15 })[0].flagged).toBe(true);
  });
});

describe("listRawPaths", () => {
  it("lists attempt files as run-relative paths and ignores other files", () => {
    const dir = mkdtempSync(join(tmpdir(), "ortsrank-raw-"));
    try {
      expect(listRawPaths(dir)).toEqual([]);
      mkdirSync(join(dir, "raw", "06412000-k1-s1"), { recursive: true });
      mkdirSync(join(dir, "raw", "06412000-k2-s1"), { recursive: true });
      writeFileSync(join(dir, "raw", "06412000-k1-s1", "attempt-1.json"), "{}");
      writeFileSync(join(dir, "raw", "06412000-k1-s1", "attempt-2.json"), "{}");
      writeFileSync(join(dir, "raw", "06412000-k2-s1", "attempt-1.json"), "{}");
      writeFileSync(join(dir, "raw", "06412000-k2-s1", "notes.txt"), "x");
      expect(listRawPaths(dir)).toEqual([
        "raw/06412000-k1-s1/attempt-1.json",
        "raw/06412000-k1-s1/attempt-2.json",
        "raw/06412000-k2-s1/attempt-1.json",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

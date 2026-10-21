import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadScan } from "@/lib/rules/measurements";
import { RunLog, attemptIdFor, rawPathFor } from "@/lib/runlog";
import { loadFixture } from "./fixtures/load";

let runs: string;
beforeEach(() => {
  runs = mkdtempSync(join(tmpdir(), "ortsrank-measure-"));
});
afterEach(() => rmSync(runs, { recursive: true, force: true }));

const AGS = "06413000";
const KW = "Terrassenüberdachung";

/** One live run with one task per raw body. */
function writeRun(runId: string, bodies: unknown[]) {
  const dir = join(runs, runId);
  mkdirSync(dir, { recursive: true });
  const tasks = bodies.map((_, i) => ({ taskKey: `${AGS}-k1-s${i + 1}`, ags: AGS, keyword: KW, sample: i + 1, session: i + 1 }));
  writeFileSync(
    join(dir, "plan.json"),
    JSON.stringify({
      runId, scanId: "scan-x", mode: "live", createdAt: "2026-10-21T07:00:00Z", project: "p", radiusKm: 30, device: "mobile", depth: 20, pointRadiusMm: 200,
      targetDomains: ["ziel-betrieb.example"], targetLocalBusinesses: [], samplingMode: "sessions",
      keywords: [{ term: KW, type: "main", samples: 3 }],
      scanned: [{ ags: AGS, name: "Offenbach am Main", lat: 50.1, lng: 8.76, population: 133195, distanceKm: 5.9 }],
      tasks,
    }),
  );
  const log = new RunLog(dir);
  bodies.forEach((body, i) => {
    const t = tasks[i];
    const raw = rawPathFor(t.taskKey, 1);
    mkdirSync(join(dir, "raw", t.taskKey), { recursive: true });
    writeFileSync(join(dir, raw), JSON.stringify(body));
    const attemptId = attemptIdFor(t.taskKey, 1);
    log.appendAttempt({ attemptId, taskKey: t.taskKey, attempt: 1, sentAt: "2026-10-21T07:00:00Z", receivedAt: "2026-10-21T07:00:05Z", outcome: "ok", statusCode: 20000, statusMessage: "Ok.", costUsd: 0.004, costCertainty: "confirmed", rawPath: raw });
    log.appendTask({ ...t, plannedAt: "09:00", status: "success", reason: null, attemptIds: [attemptId], finalAttemptId: attemptId, totalCostUsd: 0.004 });
  });
}

describe("loadScan", () => {
  it("treats a response with unparsable result items as unusable, not as a valid measurement", () => {
    const good = loadFixture("success-mixed");
    const broken = structuredClone(good) as { tasks: { result: { items: Record<string, unknown>[] }[] }[] };
    // The target's organic row cannot be parsed: absence must not be concluded.
    broken.tasks[0].result[0].items.push({ type: "organic", rank_group: "x", rank_absolute: 99, domain: "ziel-betrieb.example" });
    writeRun("20261021-090000-p-aaaaaa", [good, broken]);

    const scan = loadScan(runs, "scan-x");
    expect(scan.measurements.map((m) => m.taskKey)).toEqual([`${AGS}-k1-s1`]);
    expect(scan.failed).toEqual([
      expect.objectContaining({ taskKey: `${AGS}-k1-s2`, status: "unusable", reason: "parse_issues:organic" }),
    ]);
  });

  it("refuses runs that are not comparable", () => {
    writeRun("20261021-090000-p-aaaaaa", [loadFixture("success-mixed")]);
    writeRun("20261021-130000-p-bbbbbb", [loadFixture("success-mixed")]);
    const plan = join(runs, "20261021-130000-p-bbbbbb", "plan.json");
    const p = JSON.parse(readFileSync(plan, "utf8"));
    writeFileSync(plan, JSON.stringify({ ...p, depth: 10 }));
    expect(() => loadScan(runs, "scan-x")).toThrow(/not comparable/);
  });

  it("fails clearly when the scan has no live runs", () => {
    expect(() => loadScan(runs, "nope")).toThrow(/no live runs/);
  });
});

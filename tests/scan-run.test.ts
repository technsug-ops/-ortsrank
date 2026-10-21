import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TaskOutcome } from "@/lib/dataforseo/client";
import { parseLiveResponse } from "@/lib/dataforseo/parse";
import {
  adFrequency,
  createRunDir,
  defaultScanId,
  main,
  makeRunId,
  parseScanArgs,
  prepareScan,
  readScanEnv,
  resultsCsv,
  targetCoverage,
  type ScanArgs,
} from "@/lib/scan-run";
import { readSettlementFile } from "@/lib/settlements";
import { loadFixture } from "./fixtures/load";

const SETTLEMENTS = "tests/fixtures/settlements.sample.json";
const settlementFile = readSettlementFile(SETTLEMENTS);
const projectJson = JSON.parse(readFileSync("projects/pilot-rhein-main.json", "utf8"));

const args = (over: Partial<ScanArgs> = {}): ScanArgs => ({ ...parseScanArgs(["--project", "x.json"]), ...over });
const env = readScanEnv({ SCAN_MAX_USD: "3" });

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ortsrank-scan-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("parseScanArgs", () => {
  it("defaults to dry-run over all sessions", () => {
    expect(parseScanArgs(["--project", "p.json"])).toMatchObject({
      live: false,
      session: null,
      backToBack: false,
      settlements: "data/settlements.de.json",
      runsDir: "runs",
    });
  });

  it("accepts a live session run and a live technical trial", () => {
    expect(parseScanArgs(["--project", "p.json", "--session", "1", "--live"])).toMatchObject({ live: true, session: 1 });
    expect(
      parseScanArgs(["--project", "p.json", "--limit-settlements", "2", "--limit-keywords", "2", "--sessions", "all", "--back-to-back", "--live"]),
    ).toMatchObject({ live: true, session: null, backToBack: true, limitSettlements: 2, limitKeywords: 2 });
  });

  it.each([
    [["--live"], /--project is required/],
    [["--project", "p.json", "--live"], /--live needs --session/],
    [["--project", "p.json", "--sessions", "all", "--live"], /requires --back-to-back/],
    [["--project", "p.json", "--back-to-back"], /requires --sessions all/],
    [["--project", "p.json", "--sessions", "2"], /only accepts "all"/],
    [["--project", "p.json", "--session", "1", "--sessions", "all"], /either --session or --sessions/],
    [["--project", "p.json", "--live", "--dry-run", "--session", "1"], /either --live or --dry-run/],
    [["--project", "p.json", "--session", "0"], /positive integer/],
    [["--project", "p.json", "--limit-settlements", "two"], /positive integer/],
    [["--project", "p.json", "--scan-id", "../x"], /--scan-id/],
    [["--project", "p.json", "--unknown"], /Unknown option/],
  ])("rejects %j", (argv, error) => {
    expect(() => parseScanArgs(argv)).toThrow(error);
  });
});

describe("readScanEnv", () => {
  it("reads the cap, defaults the price and keeps credentials optional", () => {
    expect(readScanEnv({})).toEqual({ maxUsd: null, pricePerSerpUsd: 0.002, login: null, password: null });
    expect(readScanEnv({ SCAN_MAX_USD: "0.20", SCAN_PRICE_PER_SERP_USD: "0.0006" })).toMatchObject({ maxUsd: 0.2, pricePerSerpUsd: 0.0006 });
  });

  it("rejects invalid numbers", () => {
    expect(() => readScanEnv({ SCAN_MAX_USD: "abc" })).toThrow(/SCAN_MAX_USD/);
    expect(() => readScanEnv({ SCAN_PRICE_PER_SERP_USD: "-1" })).toThrow(/SCAN_PRICE_PER_SERP_USD/);
  });
});

describe("ids and run directories", () => {
  const t = new Date("2026-10-21T07:05:09Z"); // 09:05:09 in Germany

  it("builds a run id from German local time, project and a random suffix", () => {
    expect(makeRunId("pilot-rhein-main", t, () => "a1b2c3")).toBe("20261021-090509-pilot-rhein-main-a1b2c3");
    expect(makeRunId("p", t)).toMatch(/^20261021-090509-p-[0-9a-f]{6}$/);
    expect(makeRunId("p", t)).not.toBe(makeRunId("p", t));
  });

  it("shares a scan id across the sessions of one day", () => {
    expect(defaultScanId("pilot", t)).toBe("20261021-pilot");
    expect(defaultScanId("pilot", new Date("2026-10-21T16:00:00Z"))).toBe("20261021-pilot");
  });

  it("stops when the run directory already exists", () => {
    createRunDir(root, "r1");
    expect(() => createRunDir(root, "r1")).toThrow(/already exists/);
  });
});

describe("prepareScan", () => {
  it("selects settlements, builds tasks for all sessions and estimates the cost", () => {
    const p = prepareScan(projectJson, settlementFile, args(), env);
    expect(p.center).toMatchObject({ ags: "06412000", name: "Frankfurt am Main" });
    expect(p.selection.selected.map((s) => s.ags)).toEqual(["06412000", "99000001", "99000002", "99000007", "99000008"]);
    expect(p.selection.unknownPopulation.map((s) => s.ags)).toEqual(["99000004"]);
    expect(p.selection.unlocatable.map((s) => s.ags)).toEqual(["99000005"]);
    expect(p.selection.belowThreshold.map((s) => s.ags)).toEqual(["99000003"]);
    expect(p.tasks).toHaveLength(20); // 5 × (3 + 1)
    expect(p.estimate).toMatchObject({ expectedUsd: 0.096, worstCaseUsd: 0.24 });
    expect(p.cap?.status).toBe("ok");
    expect(p.samplingMode).toBe("sessions");
  });

  it("filters one session", () => {
    const p = prepareScan(projectJson, settlementFile, args({ session: 2 }), env);
    expect(p.tasks).toHaveLength(5);
    expect(p.tasks.every((t) => t.session === 2 && t.keyword === "Terrassenüberdachung")).toBe(true);
    expect(p.allTasks).toHaveLength(20);
    expect(() => prepareScan(projectJson, settlementFile, args({ session: 4 }), env)).toThrow(/session 4 is not defined/);
  });

  it("applies limits and the small live trial size from PHASE1_PLAN 6", () => {
    const p = prepareScan(projectJson, settlementFile, args({ limitSettlements: 2, limitKeywords: 2, backToBack: true }), readScanEnv({ SCAN_MAX_USD: "0.20" }));
    expect(p.scanned.map((s) => s.ags)).toEqual(["06412000", "99000001"]);
    expect(p.tasks).toHaveLength(8);
    expect(p.estimate).toMatchObject({ expectedUsd: 0.0384, worstCaseUsd: 0.096 });
    expect(p.cap?.status).toBe("ok");
    expect(p.samplingMode).toBe("technical_validation");
  });

  it("scans unknown-population settlements only on request, and flags them", () => {
    const p = prepareScan(projectJson, settlementFile, args({ includeUnknownPopulation: true }), env);
    const d = p.scanned.find((s) => s.ags === "99000004");
    expect(d).toMatchObject({ unknownPopulation: true, population: null });
    expect(p.scanned.filter((s) => !s.unknownPopulation)).toHaveLength(5);
    expect(p.scanned.some((s) => s.ags === "99000005")).toBe(false); // unlocatable never scanned
  });

  it("reports settlements cut by maxSettlements as overLimit", () => {
    const p = prepareScan({ ...projectJson, maxSettlements: 3 }, settlementFile, args(), env);
    expect(p.selection.overLimit.map((s) => s.ags)).toEqual(["99000007", "99000008"]);
  });

  it("returns cap decisions and no cap when SCAN_MAX_USD is missing", () => {
    expect(prepareScan(projectJson, settlementFile, args(), readScanEnv({ SCAN_MAX_USD: "0.1" })).cap?.status).toBe("warn_worst_case");
    expect(prepareScan(projectJson, settlementFile, args(), readScanEnv({ SCAN_MAX_USD: "0.05" })).cap?.status).toBe("rejected");
    expect(prepareScan(projectJson, settlementFile, args(), readScanEnv({})).cap).toBeNull();
  });

  it("fails clearly for a missing or unlocatable centre", () => {
    expect(() => prepareScan({ ...projectJson, centerAgs: "01001000" }, settlementFile, args(), env)).toThrow(/not found/);
    expect(() => prepareScan({ ...projectJson, centerAgs: "99000005" }, settlementFile, args(), env)).toThrow(/no coordinates/);
  });
});

// ── End to end through main() ──────────────────────────────────────────

function writeProject(over: Record<string, unknown> = {}) {
  const file = join(root, "project.json");
  writeFileSync(file, JSON.stringify({ ...projectJson, targetDomains: ["ziel-betrieb.example"], ...over }));
  return file;
}

/** Answers with the success fixture, echoing exactly what was sent. */
function echoFetch(calls: unknown[]) {
  return (async (_url: string, init: RequestInit) => {
    const [sent] = JSON.parse(init.body as string);
    calls.push(sent);
    const raw = structuredClone(loadFixture("success-mixed")) as { tasks: { data: Record<string, unknown> }[] };
    raw.tasks[0].data = { ...raw.tasks[0].data, ...sent };
    return new Response(JSON.stringify(raw), { status: 200 });
  }) as unknown as typeof fetch;
}

const failFetch = (async () => {
  throw new Error("must not send requests");
}) as unknown as typeof fetch;

describe("main", () => {
  it("dry-run writes plan.json, sends nothing and exits 0", async () => {
    const lines: string[] = [];
    const runs = join(root, "runs");
    const code = await main(
      ["--project", writeProject(), "--settlements", SETTLEMENTS, "--runs-dir", runs],
      { SCAN_MAX_USD: "3" },
      { out: (l) => lines.push(l), fetch: failFetch, random: () => "abc123", now: () => new Date("2026-10-21T07:00:00Z") },
    );
    expect(code).toBe(0);
    expect(lines[0]).toMatch(/^DRY-RUN \(no requests sent\) · run 20261021-090000-pilot-rhein-main-abc123/);
    const plan = JSON.parse(readFileSync(join(runs, "20261021-090000-pilot-rhein-main-abc123", "plan.json"), "utf8"));
    expect(plan).toMatchObject({ mode: "dry_run", scanId: "20261021-pilot-rhein-main", tasksPerSession: { 1: 10, 2: 5, 3: 5 } });
    expect(plan.lists).toMatchObject({ selected: 5, belowThreshold: 1 });
    expect(plan.lists.unlocatable).toEqual([{ ags: "99000005", name: "Beispielstadt E", population: 40000, scanNote: "missing_coordinates" }]);
    expect(existsSync(join(runs, "scans"))).toBe(false); // no budget ledger in dry-run
  });

  it("dry-run works without SCAN_MAX_USD and says so", async () => {
    const lines: string[] = [];
    const code = await main(["--project", writeProject(), "--settlements", SETTLEMENTS, "--runs-dir", join(root, "runs")], {}, { out: (l) => lines.push(l) });
    expect(code).toBe(0);
    expect(lines.join("\n")).toMatch(/SCAN_MAX_USD not set/);
  });

  it("live without SCAN_MAX_USD exits 1 before creating anything", async () => {
    const runs = join(root, "runs");
    const code = await main(["--project", writeProject(), "--settlements", SETTLEMENTS, "--runs-dir", runs, "--session", "1", "--live"], {}, { out: () => {}, fetch: failFetch });
    expect(code).toBe(1);
    expect(existsSync(runs)).toBe(false);
  });

  it("live plan above the cap exits 2 and sends nothing", async () => {
    const lines: string[] = [];
    const code = await main(
      ["--project", writeProject(), "--settlements", SETTLEMENTS, "--runs-dir", join(root, "runs"), "--session", "1", "--live"],
      { SCAN_MAX_USD: "0.01", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p" },
      { out: (l) => lines.push(l), fetch: failFetch },
    );
    expect(code).toBe(2);
    expect(lines.join("\n")).toMatch(/REJECTED/);
  });

  it("live technical trial: writes logs, raw files, results.csv and summary.json; no ad frequency", async () => {
    const runs = join(root, "runs");
    const calls: unknown[] = [];
    const lines: string[] = [];
    const code = await main(
      ["--project", writeProject(), "--settlements", SETTLEMENTS, "--runs-dir", runs,
        "--limit-settlements", "2", "--limit-keywords", "2", "--sessions", "all", "--back-to-back", "--live"],
      { SCAN_MAX_USD: "0.20", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p" },
      { out: (l) => lines.push(l), fetch: echoFetch(calls), sleep: async () => {}, random: () => "000001", now: () => new Date("2026-10-21T07:00:00Z") },
    );
    expect(code).toBe(0);
    expect(calls).toHaveLength(8);

    const runDir = join(runs, "20261021-090000-pilot-rhein-main-000001");
    expect(readdirSync(runDir).sort()).toEqual(["attempts.jsonl", "plan.json", "raw", "results.csv", "summary.json", "tasks.jsonl"]);
    expect(readdirSync(join(runDir, "raw"))).toHaveLength(8);

    const summary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8"));
    expect(summary).toMatchObject({ samplingMode: "technical_validation", adFrequency: null, settlements: 2 });
    expect(summary.run).toMatchObject({ recordIntegrity: 1, validResultRate: 1, problems: [] });
    expect(summary.run.cost).toMatchObject({ confirmedUsd: 0.032, uncertainUsd: 0 });
    expect(summary.budget).toMatchObject({ confirmedUsd: 0.032, remainingUsd: 0.168, overCapUsd: 0 });
    expect(summary.parameterMismatches).toEqual([]);
    expect(summary.sessionDrift).toEqual([]); // back-to-back: drift not evaluated
    expect(summary.targets).toEqual([{ domain: "ziel-betrieb.example", foundIn: ["06412000", "99000001"], notFoundWithinDepthIn: [] }]);
    expect(existsSync(join(runs, "scans", "20261021-pilot-rhein-main", "budget.json"))).toBe(true);
    expect(existsSync(join(runs, "scans", "20261021-pilot-rhein-main", "budget.lock"))).toBe(false);

    const csv = readFileSync(join(runDir, "results.csv"), "utf8").trim().split("\n");
    expect(csv[0]).toBe("runId,taskKey,ags,settlement,keyword,sample,session,type,rank,rankAbsolute,domain,url,title,adPosition,rating,votesCount");
    expect(csv).toHaveLength(1 + 8 * 24);
    expect(lines.join("\n")).toMatch(/Record integrity 100\.0 %/);
    expect(lines.join("\n")).toMatch(/ad frequency not computed/);
  });

  it("two sessions of one scan share the budget", async () => {
    const runs = join(root, "runs");
    const run = (session: string, random: string) =>
      main(
        ["--project", writeProject(), "--settlements", SETTLEMENTS, "--runs-dir", runs, "--session", session, "--live", "--limit-settlements", "2"],
        { SCAN_MAX_USD: "1", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p" },
        { out: () => {}, fetch: echoFetch([]), sleep: async () => {}, random: () => random, now: () => new Date("2026-10-21T07:00:00Z") },
      );
    expect(await run("1", "s1s1s1")).toBe(0); // 2 settlements × 2 keywords
    expect(await run("2", "s2s2s2")).toBe(0); // 2 settlements × main keyword
    const budget = JSON.parse(readFileSync(join(runs, "scans", "20261021-pilot-rhein-main", "budget.json"), "utf8"));
    expect(budget.confirmed).toHaveLength(6);
    expect(new Set(budget.confirmed.map((c: { runId: string }) => c.runId)).size).toBe(2);
  });

  it("prints usage on argument errors", async () => {
    const lines: string[] = [];
    expect(await main(["--live"], {}, { out: (l) => lines.push(l) })).toBe(1);
    expect(lines.join("\n")).toMatch(/Usage:/);
  });
});

describe("result helpers", () => {
  const parsed = parseLiveResponse(loadFixture("success-mixed"), { targetDomains: ["ziel-betrieb.example"] });
  const noAds = parseLiveResponse(loadFixture("success-empty-items"), { targetDomains: ["ziel-betrieb.example"] });
  const outcome = (ags: string, sample: number, p: typeof parsed): TaskOutcome => ({
    record: {
      taskKey: `${ags}-k1-s${sample}`, ags, keyword: "Terrassenüberdachung", sample, session: sample, plannedAt: "09:00",
      status: "success", reason: null, attemptIds: ["a"], finalAttemptId: "a", totalCostUsd: 0.004,
    },
    parsed: p.ok ? p : null,
    parameterMismatches: [],
    priceAboveEstimate: false,
  });

  it("computes ad frequency across sessions, but not for a technical trial", () => {
    const outs = [outcome("06412000", 1, parsed), outcome("06412000", 2, noAds), outcome("06412000", 3, parsed)];
    expect(adFrequency(outs, "sessions")).toEqual([{ ags: "06412000", keyword: "Terrassenüberdachung", samples: 3, samplesWithAds: 2 }]);
    expect(adFrequency(outs, "technical_validation")).toBeNull();
  });

  it("splits target coverage into found and not found within depth", () => {
    const cov = targetCoverage([outcome("06412000", 1, parsed), outcome("99000001", 1, noAds)]);
    expect(cov).toEqual([{ domain: "ziel-betrieb.example", foundIn: ["06412000"], notFoundWithinDepthIn: ["99000001"] }]);
  });

  it("escapes CSV cells", () => {
    const p = structuredClone(parsed);
    if (!p.ok) throw new Error("fixture");
    p.rows = [{ ...p.rows[0], title: 'Dach, "Profi"\nZeile' }];
    const csv = resultsCsv("r", [], [{ ...outcome("06412000", 1, parsed), parsed: p }]);
    expect(csv).toContain('"Dach, ""Profi""\nZeile"');
  });
});

describe("prepareScan: centre always included (includeCenter)", () => {
  // 99000003 Beispieldorf C: 8 000 inhabitants, below the 10 000 threshold.
  const project = (over: Record<string, unknown> = {}) => ({ ...projectJson, centerAgs: "99000003", includeCenter: true, ...over });

  it("puts the centre first whatever its population and fills the rest by the usual selection", () => {
    const p = prepareScan(project(), settlementFile, args(), env);
    expect(p.scanned[0]).toMatchObject({ ags: "99000003", distanceKm: 0, population: 8000 });
    expect(p.scanned.filter((s) => s.ags === "99000003")).toHaveLength(1);
    expect(p.selection.belowThreshold.some((s) => s.ags === "99000003")).toBe(false);
  });

  it("never exceeds maxSettlements, the centre included", () => {
    const p = prepareScan(project({ maxSettlements: 3 }), settlementFile, args(), env);
    expect(p.scanned).toHaveLength(3);
    expect(p.scanned[0].ags).toBe("99000003");
    expect(p.selection.overLimit.length).toBeGreaterThan(0);
    expect(prepareScan(project({ maxSettlements: 1 }), settlementFile, args(), env).scanned.map((s) => s.ags)).toEqual(["99000003"]);
  });

  it("fails clearly when the centre has no coordinates", () => {
    expect(() => prepareScan(project({ centerAgs: "99000005" }), settlementFile, args(), env)).toThrow(/has no coordinates/);
  });

  it("applies the population maximum to the other settlements", () => {
    const p = prepareScan(project({ populationMax: 140000 }), settlementFile, args(), env);
    expect(p.selection.aboveMaximum.map((s) => s.ags)).toEqual(["06412000"]);
    expect(p.scanned.some((s) => s.ags === "06412000")).toBe(false);
  });

  it("without includeCenter, a centre below the threshold is not scanned (unchanged behaviour)", () => {
    const p = prepareScan(project({ includeCenter: false }), settlementFile, args(), env);
    expect(p.scanned.some((s) => s.ags === "99000003")).toBe(false);
  });

  it("dry-run output breaks tasks down per keyword: settlements × samples", async () => {
    const lines: string[] = [];
    const file = join(root, "p.json");
    writeFileSync(file, JSON.stringify(project({ maxSettlements: 3 })));
    await main(["--project", file, "--settlements", SETTLEMENTS, "--runs-dir", join(root, "runs")], { SCAN_MAX_USD: "3" }, { out: (l) => lines.push(l) });
    const text = lines.join("\n");
    expect(text).toContain("centre Beispieldorf C (99000003) always included");
    expect(text).toContain("  Terrassenüberdachung (main): 3 × 3 = 9");
    expect(text).toContain("  Terrassenüberdachung mit Montage (intent): 3 × 1 = 3");
    expect(text).toContain("  total 12");
  });
});

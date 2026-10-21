/**
 * Scan orchestration behind scripts/scan.ts (PHASE1_PLAN 5.8):
 * project → settlement selection → tasks → cost → cap → (live) scan → summary.
 * Dry-run is the default and never sends a request.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { BudgetLedger, type BudgetSnapshot } from "@/lib/budget";
import { DataForSeoClient, type TaskOutcome } from "@/lib/dataforseo/client";
import { selectSettlements, type Selection } from "@/lib/geo";
import {
  buildTasks,
  checkCap,
  estimateCost,
  parseProject,
  tasksForSession,
  type CapDecision,
  type CostEstimate,
  type Project,
  type Task,
} from "@/lib/plan";
import { RunLog, readAttempts, readTasks, sessionDrift, summarizeRun, type RunSummary, type SessionDrift } from "@/lib/runlog";
import { DEFAULT_PRICE_PER_SERP_USD, SESSION_TIME_ZONE } from "@/lib/scan-defaults";
import { DEFAULT_SETTLEMENTS_FILE, readSettlementFile, type Settlement, type SettlementFile } from "@/lib/settlements";

// ── Arguments and environment ──────────────────────────────────────────

export interface ScanArgs {
  project: string;
  settlements: string;
  live: boolean;
  /** null = all sessions (dry-run default, or --sessions all). */
  session: number | null;
  backToBack: boolean;
  limitSettlements: number | null;
  limitKeywords: number | null;
  includeUnknownPopulation: boolean;
  scanId: string | null;
  runsDir: string;
}

export const USAGE = `Usage:
  npx tsx scripts/scan.ts --project <file> [--dry-run]
  npx tsx scripts/scan.ts --project <file> --session <id> --live
  npx tsx scripts/scan.ts --project <file> --sessions all --back-to-back --live

Options:
  --settlements <file>          settlement list (default ${DEFAULT_SETTLEMENTS_FILE})
  --limit-settlements <n>       nearest n selected settlements only
  --limit-keywords <n>          first n keywords only
  --include-unknown-population  also scan settlements with unknown population
  --scan-id <id>                sessions of one scan share a budget (default <YYYYMMDD>-<project>)
  --runs-dir <dir>              output root (default runs)

Environment: SCAN_MAX_USD (required for --live), SCAN_PRICE_PER_SERP_USD,
DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD (for --live).`;

function positiveInt(name: string, value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer, got "${value}"`);
  return n;
}

export function parseScanArgs(argv: string[]): ScanArgs {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      project: { type: "string" },
      settlements: { type: "string" },
      "dry-run": { type: "boolean" },
      live: { type: "boolean" },
      session: { type: "string" },
      sessions: { type: "string" },
      "back-to-back": { type: "boolean" },
      "limit-settlements": { type: "string" },
      "limit-keywords": { type: "string" },
      "include-unknown-population": { type: "boolean" },
      "scan-id": { type: "string" },
      "runs-dir": { type: "string" },
    },
  });
  if (!values.project) throw new Error("--project is required");
  if (values.live && values["dry-run"]) throw new Error("use either --live or --dry-run, not both");
  if (values.session !== undefined && values.sessions !== undefined) throw new Error("use either --session or --sessions, not both");
  if (values.sessions !== undefined && values.sessions !== "all") throw new Error('--sessions only accepts "all"');
  const live = values.live === true;
  const allSessions = values.sessions === "all";
  const backToBack = values["back-to-back"] === true;
  if (backToBack && !allSessions) throw new Error("--back-to-back requires --sessions all");
  if (live && values.session === undefined && !allSessions) {
    throw new Error("--live needs --session <id>, or --sessions all --back-to-back for a technical trial");
  }
  // Running all sessions at once only makes sense as a technical trial (5.7).
  if (live && allSessions && !backToBack) throw new Error("--sessions all with --live requires --back-to-back");
  if (values["scan-id"] !== undefined && !/^[A-Za-z0-9_-]+$/.test(values["scan-id"])) {
    throw new Error("--scan-id may only contain letters, digits, - and _");
  }
  return {
    project: values.project,
    settlements: values.settlements ?? DEFAULT_SETTLEMENTS_FILE,
    live,
    session: positiveInt("--session", values.session),
    backToBack,
    limitSettlements: positiveInt("--limit-settlements", values["limit-settlements"]),
    limitKeywords: positiveInt("--limit-keywords", values["limit-keywords"]),
    includeUnknownPopulation: values["include-unknown-population"] === true,
    scanId: values["scan-id"] ?? null,
    runsDir: values["runs-dir"] ?? "runs",
  };
}

export interface ScanEnv {
  maxUsd: number | null;
  pricePerSerpUsd: number;
  login: string | null;
  password: string | null;
}

function positiveNumber(name: string, value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  if (!(n > 0)) throw new Error(`${name} must be a positive number, got "${value}"`);
  return n;
}

export function readScanEnv(env: Record<string, string | undefined>): ScanEnv {
  return {
    maxUsd: positiveNumber("SCAN_MAX_USD", env.SCAN_MAX_USD),
    pricePerSerpUsd: positiveNumber("SCAN_PRICE_PER_SERP_USD", env.SCAN_PRICE_PER_SERP_USD) ?? DEFAULT_PRICE_PER_SERP_USD,
    login: env.DATAFORSEO_LOGIN || null,
    password: env.DATAFORSEO_PASSWORD || null,
  };
}

// ── Ids ─────────────────────────────────────────────────────────────────

function localParts(now: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: SESSION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)!.value;
  return { date: `${get("year")}${get("month")}${get("day")}`, time: `${get("hour")}${get("minute")}${get("second")}` };
}

/** `<YYYYMMDD-HHMMSS>-<project>-<6 random chars>`, German local time. */
export function makeRunId(projectName: string, now: Date, random: () => string = () => randomBytes(3).toString("hex")): string {
  const { date, time } = localParts(now);
  return `${date}-${time}-${projectName}-${random()}`;
}

/** Sessions of one day and project share a scan (and its budget) by default. */
export function defaultScanId(projectName: string, now: Date): string {
  return `${localParts(now).date}-${projectName}`;
}

// ── Preparation (dry-run and live) ──────────────────────────────────────

export type SamplingMode = "sessions" | "technical_validation";

export interface ScannedSettlement {
  ags: string;
  name: string;
  lat: number;
  lng: number;
  population: number | null;
  distanceKm: number;
  /** True when scanned via --include-unknown-population; flagged in reports. */
  unknownPopulation: boolean;
}

export interface PreparedScan {
  project: Project;
  settlementSource: Pick<SettlementFile, "source" | "sourceFile" | "asOf">;
  center: { ags: string; name: string; lat: number; lng: number };
  selection: Selection<Settlement>;
  scanned: ScannedSettlement[];
  keywords: Project["keywords"];
  /** All tasks of the scan, every session. */
  allTasks: Task[];
  /** Tasks of this run (one session, or all). */
  tasks: Task[];
  session: number | null;
  samplingMode: SamplingMode;
  estimate: CostEstimate;
  cap: CapDecision | null;
}

export function prepareScan(projectInput: unknown, settlementFile: SettlementFile, args: ScanArgs, env: ScanEnv): PreparedScan {
  const project = parseProject(projectInput);
  const centerRow = settlementFile.settlements.find((s) => s.ags === project.centerAgs);
  if (!centerRow) throw new Error(`centre AGS ${project.centerAgs} not found in settlement file`);
  if (centerRow.lat === null || centerRow.lng === null) {
    throw new Error(`centre ${centerRow.name} (${centerRow.ags}) has no coordinates; cannot select by radius`);
  }
  const center = { ags: centerRow.ags, name: centerRow.name, lat: centerRow.lat, lng: centerRow.lng };

  // With includeCenter the centre takes the first slot whatever its population;
  // the remaining slots are filled by the usual selection without it.
  const candidates = project.includeCenter ? settlementFile.settlements.filter((s) => s.ags !== centerRow.ags) : settlementFile.settlements;
  const explicit = project.settlementAgs?.filter((a) => !(project.includeCenter && a === centerRow.ags));
  const selection = selectSettlements(candidates, {
    center,
    radiusKm: project.radiusKm,
    populationMin: project.populationMin,
    populationMax: project.populationMax,
    limit: explicit ? undefined : project.includeCenter ? project.maxSettlements - 1 : project.maxSettlements,
  });
  if (explicit) {
    // Explicit list: every entry must qualify; qualified ones not listed are reported as not selected (overLimit).
    const total = explicit.length + (project.includeCenter ? 1 : 0);
    if (total > project.maxSettlements) throw new Error(`settlementAgs has ${total} settlements (centre included), more than maxSettlements ${project.maxSettlements}`);
    for (const ags of explicit) {
      if (selection.selected.some((s) => s.ags === ags)) continue;
      const row = settlementFile.settlements.find((s) => s.ags === ags);
      const why = !row
        ? "not in the settlement file"
        : row.lat === null
          ? "has no coordinates"
          : selection.belowThreshold.some((s) => s.ags === ags) || selection.aboveMaximum.some((s) => s.ags === ags)
            ? "is outside the population bounds"
            : selection.unknownPopulation.some((s) => s.ags === ags)
              ? "has no population"
              : "is outside the radius";
      throw new Error(`settlementAgs: ${ags}${row ? ` (${row.name})` : ""} ${why}`);
    }
    const chosen = selection.selected.filter((s) => explicit.includes(s.ags));
    selection.overLimit = selection.selected.filter((s) => !explicit.includes(s.ags));
    selection.selected = chosen;
  }
  if (project.includeCenter) selection.selected.unshift({ ...centerRow, distanceKm: 0 });

  const toScanned = (s: Selection<Settlement>["selected"][number], unknownPopulation: boolean): ScannedSettlement => ({
    ags: s.ags,
    name: s.name,
    lat: s.lat!,
    lng: s.lng!,
    population: s.population,
    distanceKm: s.distanceKm,
    unknownPopulation,
  });
  let scanned = [
    ...selection.selected.map((s) => toScanned(s, false)),
    ...(args.includeUnknownPopulation ? selection.unknownPopulation.map((s) => toScanned(s, true)) : []),
  ].sort((a, b) => a.distanceKm - b.distanceKm);
  if (args.limitSettlements !== null) scanned = scanned.slice(0, args.limitSettlements);

  const keywords = args.limitKeywords === null ? project.keywords : project.keywords.slice(0, args.limitKeywords);
  const allTasks = buildTasks({ ...project, keywords }, scanned);
  if (args.session !== null && !project.sessions.some((s) => s.id === args.session)) {
    throw new Error(`session ${args.session} is not defined in the project`);
  }
  const tasks = args.session === null ? allTasks : tasksForSession(allTasks, args.session);
  const estimate = estimateCost(tasks.length, project.depth, { pricePerSerpUsd: env.pricePerSerpUsd });

  return {
    project,
    settlementSource: { source: settlementFile.source, sourceFile: settlementFile.sourceFile, asOf: settlementFile.asOf },
    center,
    selection,
    scanned,
    keywords,
    allTasks,
    tasks,
    session: args.session,
    samplingMode: args.backToBack ? "technical_validation" : "sessions",
    estimate,
    cap: env.maxUsd === null ? null : checkCap(estimate, env.maxUsd),
  };
}

/** Machine-readable plan (plan.json). */
export function planDocument(p: PreparedScan, meta: { runId: string; scanId: string; mode: "dry_run" | "live"; createdAt: string }) {
  const brief = (s: { ags: string; name: string; population: number | null }) => ({ ags: s.ags, name: s.name, population: s.population });
  return {
    ...meta,
    project: p.project.name,
    settlementSource: p.settlementSource,
    center: p.center,
    radiusKm: p.project.radiusKm,
    populationMin: p.project.populationMin,
    populationMax: p.project.populationMax ?? null,
    includeCenter: p.project.includeCenter,
    selectionMode: p.project.settlementAgs ? "explicit_list" : "nearest_first",
    brandNames: p.project.brandNames,
    maxSettlements: p.project.maxSettlements,
    device: p.project.device,
    depth: p.project.depth,
    pointRadiusMm: p.project.pointRadiusMm,
    targetDomains: p.project.targetDomains,
    targetLocalBusinesses: p.project.targetLocalBusinesses,
    samplingMode: p.samplingMode,
    session: p.session,
    sessions: p.project.sessions,
    keywords: p.keywords,
    scanned: p.scanned,
    lists: {
      selected: p.selection.selected.length,
      unknownPopulation: p.selection.unknownPopulation.map((s) => ({ ...brief(s), distanceKm: s.distanceKm })),
      unlocatable: p.selection.unlocatable.map((s) => ({ ...brief(s), scanNote: s.scanNote })),
      belowThreshold: p.selection.belowThreshold.length,
      aboveMaximum: p.selection.aboveMaximum.map((s) => ({ ...brief(s), distanceKm: s.distanceKm })),
      overLimit: p.selection.overLimit.map((s) => ({ ...brief(s), distanceKm: s.distanceKm })),
    },
    tasksPerSession: Object.fromEntries(p.project.sessions.map((s) => [s.id, tasksForSession(p.allTasks, s.id).length])),
    tasks: p.tasks.map((t) => ({ taskKey: t.taskKey, ags: t.ags, keyword: t.keyword, sample: t.sample, session: t.session, plannedAt: t.plannedAt })),
    estimate: p.estimate,
    cap: p.cap,
  };
}

/** Creates runs/<runId>; stops if it already exists. */
export function createRunDir(runsDir: string, runId: string): string {
  mkdirSync(runsDir, { recursive: true });
  const dir = join(runsDir, runId);
  try {
    mkdirSync(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`run directory ${dir} already exists`);
    throw e;
  }
  return dir;
}

// ── Results ─────────────────────────────────────────────────────────────

export interface AdFrequency {
  ags: string;
  keyword: string;
  samples: number;
  samplesWithAds: number;
}

/**
 * Ads seen per settlement × keyword across samples. Not computed for a
 * technical trial: back-to-back samples say nothing about ad frequency (5.7).
 */
export function adFrequency(outcomes: readonly TaskOutcome[], samplingMode: SamplingMode): AdFrequency[] | null {
  if (samplingMode === "technical_validation") return null;
  const groups = new Map<string, AdFrequency>();
  for (const o of outcomes) {
    if (!o.parsed) continue;
    const key = `${o.record.ags}|${o.record.keyword}`;
    const g = groups.get(key) ?? { ags: o.record.ags, keyword: o.record.keyword, samples: 0, samplesWithAds: 0 };
    g.samples += 1;
    if (o.parsed.rows.some((r) => r.type === "ad")) g.samplesWithAds += 1;
    groups.set(key, g);
  }
  return [...groups.values()];
}

const CSV_COLUMNS = [
  "runId", "taskKey", "ags", "settlement", "keyword", "sample", "session", "type", "rank", "rankAbsolute",
  "domain", "url", "title", "adPosition", "rating", "votesCount",
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function resultsCsv(runId: string, tasks: readonly Task[], outcomes: readonly TaskOutcome[]): string {
  const byKey = new Map(tasks.map((t) => [t.taskKey, t]));
  const lines = [CSV_COLUMNS.join(",")];
  for (const o of outcomes) {
    if (!o.parsed) continue;
    const t = byKey.get(o.record.taskKey);
    for (const r of o.parsed.rows) {
      const row = {
        runId,
        taskKey: o.record.taskKey,
        ags: o.record.ags,
        settlement: t?.settlementName,
        keyword: o.record.keyword,
        sample: o.record.sample,
        session: o.record.session,
        type: r.type,
        rank: r.rank,
        rankAbsolute: r.rankAbsolute,
        domain: r.domain,
        url: r.url,
        title: r.title,
        adPosition: r.adPosition,
        rating: r.rating,
        votesCount: r.votesCount,
      };
      lines.push(CSV_COLUMNS.map((c) => csvCell(row[c])).join(","));
    }
  }
  return `${lines.join("\n")}\n`;
}

export interface TargetCoverage {
  domain: string;
  /** Settlements where the domain was found in at least one successful task. */
  foundIn: string[];
  /** Settlements with successful tasks where it was not found within the scanned depth. */
  notFoundWithinDepthIn: string[];
}

export function targetCoverage(outcomes: readonly TaskOutcome[]): TargetCoverage[] {
  const map = new Map<string, { found: Set<string>; seen: Set<string> }>();
  for (const o of outcomes) {
    for (const t of o.parsed?.targets ?? []) {
      const e = map.get(t.domain) ?? { found: new Set(), seen: new Set() };
      e.seen.add(o.record.ags);
      if (t.status === "found") e.found.add(o.record.ags);
      map.set(t.domain, e);
    }
  }
  return [...map].map(([domain, e]) => ({
    domain,
    foundIn: [...e.found].sort(),
    notFoundWithinDepthIn: [...e.seen].filter((a) => !e.found.has(a)).sort(),
  }));
}

export interface LiveSummary {
  runId: string;
  scanId: string;
  samplingMode: SamplingMode;
  session: number | null;
  settlements: number;
  run: RunSummary;
  budget: BudgetSnapshot;
  sessionDrift: SessionDrift[];
  parameterMismatches: { taskKey: string; issues: string[] }[];
  adFrequency: AdFrequency[] | null;
  targets: TargetCoverage[];
  finishedAt: string;
}

export interface LiveDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  isProcessAlive?: (pid: number) => boolean;
}

export async function runLiveScan(
  p: PreparedScan,
  ctx: { runId: string; scanId: string; runDir: string; runsDir: string; env: ScanEnv },
  deps: LiveDeps = {},
): Promise<LiveSummary> {
  if (ctx.env.maxUsd === null) throw new Error("SCAN_MAX_USD is required for --live");
  if (!p.cap || p.cap.status === "rejected") throw new Error("plan exceeds SCAN_MAX_USD; not starting");
  const now = deps.now ?? (() => new Date());
  const client = new DataForSeoClient({
    credentials: { login: ctx.env.login ?? "", password: ctx.env.password ?? "" },
    fetch: deps.fetch,
    sleep: deps.sleep,
    now,
  });
  const ledger = BudgetLedger.open({
    scanDir: join(ctx.runsDir, "scans", ctx.scanId),
    scanId: ctx.scanId,
    runId: ctx.runId,
    maxUsd: ctx.env.maxUsd,
    costPerAttemptUsd: p.estimate.costPerAttemptUsd,
    now,
    isProcessAlive: deps.isProcessAlive,
  });
  try {
    const log = new RunLog(ctx.runDir);
    const outcomes = await client.runTasks(p.tasks, { runDir: ctx.runDir, project: p.project, ledger, log });
    const tasks = readTasks(ctx.runDir);
    const attempts = readAttempts(ctx.runDir);
    writeFileSync(join(ctx.runDir, "results.csv"), resultsCsv(ctx.runId, p.tasks, outcomes), "utf8");
    const summary: LiveSummary = {
      runId: ctx.runId,
      scanId: ctx.scanId,
      samplingMode: p.samplingMode,
      session: p.session,
      settlements: p.scanned.length,
      run: summarizeRun({
        plannedTaskKeys: p.tasks.map((t) => t.taskKey),
        tasks,
        attempts,
        expectedUsd: p.estimate.expectedUsd,
        worstCaseUsd: p.estimate.worstCaseUsd,
      }),
      budget: ledger.snapshot(),
      // Back-to-back trials run sessions at once on purpose; drift is not meaningful there.
      sessionDrift: p.samplingMode === "technical_validation" ? [] : sessionDrift(tasks, attempts),
      parameterMismatches: outcomes
        .filter((o) => o.parameterMismatches.length)
        .map((o) => ({ taskKey: o.record.taskKey, issues: o.parameterMismatches })),
      adFrequency: adFrequency(outcomes, p.samplingMode),
      targets: targetCoverage(outcomes),
      finishedAt: now().toISOString(),
    };
    writeFileSync(join(ctx.runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return summary;
  } finally {
    ledger.close();
  }
}

// ── Console output ──────────────────────────────────────────────────────

const usd = (n: number) => `$${n.toFixed(4)}`;
const pct = (n: number | null) => (n === null ? "n/a" : `${(n * 100).toFixed(1)} %`);

export function formatPlan(p: PreparedScan, runId: string, scanId: string, live: boolean): string {
  const lines = [
    `${live ? "LIVE" : "DRY-RUN (no requests sent)"} · run ${runId} · scan ${scanId}`,
    `Project ${p.project.name}: centre ${p.center.name} (${p.center.ags})${p.project.includeCenter ? " always included" : ""}, radius ${p.project.radiusKm} km, population ≥ ${p.project.populationMin}${p.project.populationMax !== undefined ? ` and ≤ ${p.project.populationMax}` : ""}, max ${p.project.maxSettlements}`,
    `Settlements${p.project.settlementAgs ? " (explicit list; qualified but not listed count as over limit)" : ""}: ${p.selection.selected.length} selected · ${p.selection.unknownPopulation.length} unknown population · ${p.selection.unlocatable.length} unlocatable · ${p.selection.belowThreshold.length} below threshold · ${p.selection.aboveMaximum.length} above maximum · ${p.selection.overLimit.length} over limit`,
    `Scanned: ${p.scanned.length}${p.scanned.some((s) => s.unknownPopulation) ? " (incl. unknown population, flagged)" : ""}`,
    ...p.scanned.map((s) => `  ${s.ags}  ${s.name.padEnd(28)} ${s.distanceKm.toFixed(1).padStart(5)} km  ${s.population ?? "population unknown"}`),
    `Keywords: ${p.keywords.map((k) => `${k.term} (${k.type}, ${k.samples}×)`).join(" · ")}`,
    `Sessions: ${p.project.sessions.map((s) => `${s.id} @ ${s.plannedAt}: ${tasksForSession(p.allTasks, s.id).length} tasks`).join(" · ")}`,
    `Tasks = settlements × keyword samples (one sample per session):`,
    ...p.keywords.map((k) => {
      const n = p.allTasks.filter((t) => t.keyword === k.term).length;
      return `  ${k.term} (${k.type}): ${p.scanned.length} × ${k.samples} = ${n}`;
    }),
    `  total ${p.allTasks.length}`,
    `This run: ${p.session === null ? "all sessions" : `session ${p.session}`}, ${p.tasks.length} tasks, sampling ${p.samplingMode}`,
    `Cost: expected ${usd(p.estimate.expectedUsd)} · worst case ${usd(p.estimate.worstCaseUsd)} (${p.estimate.maxAttempts} attempts × ${usd(p.estimate.costPerAttemptUsd)})`,
    p.cap === null
      ? "Cap: SCAN_MAX_USD not set"
      : `Cap: ${usd(p.cap.maxUsd)} → ${p.cap.status === "ok" ? "ok" : p.cap.status === "warn_worst_case" ? "ok, but worst case exceeds the cap (enforced per request)" : "REJECTED: expected cost exceeds the cap"}`,
  ];
  return lines.join("\n");
}

export function formatLiveSummary(s: LiveSummary): string {
  const r = s.run;
  return [
    `Done: ${r.plannedTasks} tasks, ${r.attempts} attempts`,
    `Record integrity ${pct(r.recordIntegrity)} (must be 100 %) · valid results ${pct(r.validResultRate)} (target ${pct(r.validResultTarget)})`,
    `Status: ${r.statusCounts.success} success · ${r.statusCounts.error} error · ${r.statusCounts.cancelled} cancelled${Object.keys(r.reasons).length ? ` (${Object.entries(r.reasons).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`,
    `Cost: confirmed ${usd(r.cost.confirmedUsd)} · uncertain ${usd(r.cost.uncertainUsd)} · expected ${usd(r.cost.expectedUsd)} · worst case ${usd(r.cost.worstCaseUsd)}`,
    `Scan budget ${usd(s.budget.maxUsd)}: remaining ${usd(s.budget.remainingUsd)}${s.budget.overCapUsd > 0 ? ` · CAP EXCEEDED by ${usd(s.budget.overCapUsd)} (provider price above estimate)` : ""}`,
    ...s.budget.priceDeviations.map((d) => `  price deviation ${d.attemptId}: reserved ${usd(d.reservedUsd)}, charged ${usd(d.actualUsd)}`),
    ...s.sessionDrift.filter((d) => d.flagged).map((d) => `  session ${d.session} started ${d.maxDriftMinutes} min away from ${d.plannedAt}`),
    ...s.parameterMismatches.map((m) => `  parameter mismatch ${m.taskKey}: ${m.issues.join("; ")}`),
    ...s.targets.map((t) => `Target ${t.domain}: found in ${t.foundIn.length} settlements, not found within scanned depth in ${t.notFoundWithinDepthIn.length}`),
    s.samplingMode === "technical_validation" ? "Sampling: technical_validation, ad frequency not computed" : "",
    ...(r.problems.length ? ["Problems:", ...r.problems.map((x) => `  ${x}`)] : []),
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Entry point ─────────────────────────────────────────────────────────

export interface MainDeps extends LiveDeps {
  out?: (line: string) => void;
  random?: () => string;
}

/** Returns the process exit code: 0 ok, 1 error, 2 plan rejected by the cap. */
export async function main(argv: string[], env: Record<string, string | undefined>, deps: MainDeps = {}): Promise<number> {
  const out = deps.out ?? ((l: string) => console.log(l));
  const now = deps.now ?? (() => new Date());
  try {
    const args = parseScanArgs(argv);
    const scanEnv = readScanEnv(env);
    const projectInput = JSON.parse(readFileSync(args.project, "utf8"));
    const prepared = prepareScan(projectInput, readSettlementFile(args.settlements), args, scanEnv);
    const started = now();
    const runId = makeRunId(prepared.project.name, started, deps.random);
    const scanId = args.scanId ?? defaultScanId(prepared.project.name, started);

    out(formatPlan(prepared, runId, scanId, args.live));
    if (args.live && scanEnv.maxUsd === null) {
      out("SCAN_MAX_USD is not set; live scan not started.");
      return 1;
    }

    const runDir = createRunDir(args.runsDir, runId);
    const plan = planDocument(prepared, { runId, scanId, mode: args.live ? "live" : "dry_run", createdAt: started.toISOString() });
    writeFileSync(join(runDir, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    out(`Plan written to ${join(runDir, "plan.json")}`);

    if (!args.live) return 0;
    if (prepared.cap?.status === "rejected") {
      out("Live scan not started: expected cost exceeds SCAN_MAX_USD.");
      return 2;
    }
    const summary = await runLiveScan(prepared, { runId, scanId, runDir, runsDir: args.runsDir, env: scanEnv }, deps);
    out(formatLiveSummary(summary));
    return 0;
  } catch (e) {
    out(`Error: ${(e as Error).message}`);
    if (e instanceof Error && /--|required|must|requires|only accepts|Unknown option/i.test(e.message)) out(USAGE);
    return 1;
  }
}

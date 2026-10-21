/**
 * Loads one scan (all session runs) as measurements for the rules.
 *
 * One measurement = one task (settlement × keyword × sample/session) with
 * its single selected valid result: the task's final successful attempt.
 * Retries of a task are not extra samples. If a task succeeded in more than
 * one run, the first successful run (by run id, i.e. time) is used.
 * Failed or cancelled tasks are kept apart and never count as "not found".
 * A response with items that could not be parsed (`issues`) is not usable
 * either: absence of a result type cannot be concluded from it.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { PostalAddress } from "@/lib/dataforseo/local-identity";
import { parseLiveResponse, type SerpRow } from "@/lib/dataforseo/parse";
import { verifiedAddressSchema } from "@/lib/plan";
import { readAttempts, readTasks } from "@/lib/runlog";

const planSchema = z.object({
  runId: z.string(),
  scanId: z.string(),
  mode: z.enum(["dry_run", "live"]),
  createdAt: z.string(),
  project: z.string(),
  radiusKm: z.number(),
  device: z.enum(["mobile", "desktop"]),
  depth: z.number().int(),
  pointRadiusMm: z.number().int(),
  targetDomains: z.array(z.string()).default([]),
  brandNames: z.array(z.string()).default([]),
  targetLocalBusinesses: z
    .array(
      z.object({
        label: z.string().optional(),
        cid: z.string().optional(),
        googleId: z.string().optional(),
        profileName: z.string().optional(),
        address: verifiedAddressSchema.optional(),
        source: z.string().optional(),
      }),
    )
    .default([]),
  samplingMode: z.enum(["sessions", "technical_validation"]),
  keywords: z.array(z.object({ term: z.string(), type: z.string(), samples: z.number().int() })),
  scanned: z.array(
    z.object({
      ags: z.string(),
      name: z.string(),
      lat: z.number(),
      lng: z.number(),
      population: z.number().nullable(),
      distanceKm: z.number(),
    }),
  ),
  tasks: z.array(z.object({ taskKey: z.string(), ags: z.string(), keyword: z.string(), sample: z.number(), session: z.number() })),
});

export type RunPlan = z.infer<typeof planSchema>;

export interface PlannedSettlement {
  ags: string;
  name: string;
  population: number | null;
  distanceKm: number;
  lat: number;
  lng: number;
}

export interface Measurement {
  runId: string;
  taskKey: string;
  ags: string;
  keyword: string;
  sample: number;
  session: number;
  samplingMode: RunPlan["samplingMode"];
  /** Relative to the runs directory: <runId>/raw/<taskKey>/attempt-<n>.json */
  rawPath: string;
  /** Provider result time. */
  datetime: string | null;
  device: RunPlan["device"];
  /** "lat,lng,radiusMm" as sent. */
  coordinate: string;
  depth: number;
  rows: SerpRow[];
}

export interface FailedTask {
  runId: string;
  taskKey: string;
  ags: string;
  keyword: string;
  session: number;
  /** unusable: the provider answered, but some result items could not be parsed. */
  status: "error" | "cancelled" | "unusable";
  reason: string | null;
}

/** A verified Google profile of the target business (RULES_V0 section 10). */
export interface TargetProfile {
  /** Stable key for reports: label, else cid, else googleId. */
  key: string;
  label: string | null;
  cid: string | null;
  googleId: string | null;
  address: PostalAddress | null;
  source: string | null;
}

type TargetLocalBusiness = RunPlan["targetLocalBusinesses"][number];

export function targetProfilesFrom(list: readonly TargetLocalBusiness[]): TargetProfile[] {
  return list
    .filter((b) => b.cid || b.googleId || b.address)
    .map((b) => ({
      key: b.label ?? b.cid ?? b.googleId ?? `${b.address!.street} ${b.address!.houseNumber}`,
      label: b.label ?? null,
      cid: b.cid ?? null,
      googleId: b.googleId ?? null,
      address: b.address ?? null,
      source: b.source ?? null,
    }));
}

export interface ScanData {
  scanId: string;
  runIds: string[];
  project: string;
  radiusKm: number;
  depth: number;
  device: RunPlan["device"];
  targetDomains: string[];
  targetCids: string[];
  /** Google profile names of the target business; never a match on their own. */
  targetProfileNames: string[];
  /** Verified Google profiles (cid, googleId, address) of the target business. */
  targetProfiles: TargetProfile[];
  /** Where the target identity came from: the run plans, or a project file given later. */
  identitySource: string;
  /** Brand words; Local Pack entries with the brand but not the profile name are other locations. */
  brandNames: string[];
  keywords: { term: string; type: string; samples: number }[];
  settlements: PlannedSettlement[];
  /** Planned tasks per settlement × keyword, across the runs found. */
  plannedTasks: { taskKey: string; ags: string; keyword: string; session: number }[];
  measurements: Measurement[];
  failed: FailedTask[];
}

export function loadScan(runsDir: string, scanId: string): ScanData {
  if (!existsSync(runsDir)) throw new Error(`runs directory ${runsDir} not found`);
  const plans: RunPlan[] = [];
  for (const entry of readdirSync(runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "scans") continue;
    const file = join(runsDir, entry.name, "plan.json");
    if (!existsSync(file)) continue;
    const plan = planSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (plan.success && plan.data.scanId === scanId && plan.data.mode === "live") plans.push(plan.data);
  }
  if (plans.length === 0) throw new Error(`no live runs found for scan ${scanId} in ${runsDir}`);
  plans.sort((a, b) => a.runId.localeCompare(b.runId));
  const first = plans[0];
  for (const p of plans) {
    if (p.depth !== first.depth || p.device !== first.device || p.pointRadiusMm !== first.pointRadiusMm) {
      throw new Error(`run ${p.runId} uses different depth/device/point radius than ${first.runId}; runs are not comparable`);
    }
  }

  const settlements = new Map<string, PlannedSettlement>();
  const keywords = new Map<string, { term: string; type: string; samples: number }>();
  const planned = new Map<string, ScanData["plannedTasks"][number]>();
  const measurements = new Map<string, Measurement>();
  const failed = new Map<string, FailedTask>();

  for (const plan of plans) {
    for (const s of plan.scanned) settlements.set(s.ags, { ...s });
    for (const k of plan.keywords) keywords.set(k.term, k);
    for (const t of plan.tasks) planned.set(t.taskKey, { taskKey: t.taskKey, ags: t.ags, keyword: t.keyword, session: t.session });

    const runDir = join(runsDir, plan.runId);
    const attempts = new Map(readAttempts(runDir).map((a) => [a.attemptId, a]));
    const coord = new Map(plan.scanned.map((s) => [s.ags, `${s.lat},${s.lng},${plan.pointRadiusMm}`]));
    for (const t of readTasks(runDir)) {
      if (t.status !== "success") {
        if (!measurements.has(t.taskKey)) {
          failed.set(t.taskKey, { runId: plan.runId, taskKey: t.taskKey, ags: t.ags, keyword: t.keyword, session: t.session, status: t.status, reason: t.reason });
        }
        continue;
      }
      if (measurements.has(t.taskKey)) continue; // first successful run wins
      const attempt = t.finalAttemptId ? attempts.get(t.finalAttemptId) : undefined;
      if (!attempt || attempt.outcome !== "ok") continue;
      const raw = JSON.parse(readFileSync(join(runDir, attempt.rawPath), "utf8"));
      const parsed = parseLiveResponse(raw, { targetDomains: plan.targetDomains });
      if (!parsed.ok) continue;
      if (parsed.issues.length) {
        const types = [...new Set(parsed.issues.map((i) => i.type))].sort().join(",");
        failed.set(t.taskKey, { runId: plan.runId, taskKey: t.taskKey, ags: t.ags, keyword: t.keyword, session: t.session, status: "unusable", reason: `parse_issues:${types}` });
        continue;
      }
      failed.delete(t.taskKey);
      measurements.set(t.taskKey, {
        runId: plan.runId,
        taskKey: t.taskKey,
        ags: t.ags,
        keyword: t.keyword,
        sample: t.sample,
        session: t.session,
        samplingMode: plan.samplingMode,
        rawPath: `${plan.runId}/${attempt.rawPath}`,
        datetime: parsed.datetime,
        device: plan.device,
        coordinate: coord.get(t.ags) ?? "unknown",
        depth: parsed.depth ?? plan.depth,
        rows: parsed.rows,
      });
    }
  }

  return {
    scanId,
    runIds: plans.map((p) => p.runId),
    project: first.project,
    radiusKm: first.radiusKm,
    depth: first.depth,
    device: first.device,
    targetDomains: [...new Set(plans.flatMap((p) => p.targetDomains))],
    targetCids: [...new Set(plans.flatMap((p) => p.targetLocalBusinesses.flatMap((b) => (b.cid ? [b.cid] : []))))],
    brandNames: [...new Set(plans.flatMap((p) => p.brandNames))],
    targetProfileNames: [...new Set(plans.flatMap((p) => p.targetLocalBusinesses.flatMap((b) => (b.profileName ? [b.profileName] : []))))],
    targetProfiles: dedupeProfiles(targetProfilesFrom(plans.flatMap((p) => p.targetLocalBusinesses))),
    identitySource: "plan",
    keywords: [...keywords.values()],
    settlements: [...settlements.values()].sort((a, b) => a.distanceKm - b.distanceKm),
    plannedTasks: [...planned.values()],
    measurements: [...measurements.values()],
    failed: [...failed.values()],
  };
}

function dedupeProfiles(list: TargetProfile[]): TargetProfile[] {
  const seen = new Map<string, TargetProfile>();
  for (const p of list) seen.set(JSON.stringify([p.cid, p.googleId, p.address]), p);
  return [...seen.values()];
}

/**
 * Replaces the target identity of a loaded scan with the one in a project file,
 * e.g. profiles verified after the run. Run artifacts stay unchanged.
 */
export function withProjectIdentity(
  scan: ScanData,
  project: { targetDomains: string[]; brandNames: string[]; targetLocalBusinesses: TargetLocalBusiness[] },
  source: string,
): ScanData {
  const list = project.targetLocalBusinesses;
  return {
    ...scan,
    targetDomains: project.targetDomains,
    brandNames: project.brandNames,
    targetCids: [...new Set(list.flatMap((b) => (b.cid ? [b.cid] : [])))],
    targetProfileNames: [...new Set(list.flatMap((b) => (b.profileName ? [b.profileName] : [])))],
    targetProfiles: dedupeProfiles(targetProfilesFrom(list)),
    identitySource: source,
  };
}

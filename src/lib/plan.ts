/**
 * Scan planning: project definition → tasks → cost estimate → cap check.
 * Pure logic, no network. See PHASE1_PLAN 5.3 and 5.7.
 */
import { z } from "zod";
import { device, keywordType } from "@/db/schema";
import {
  DEFAULT_EXPECTED_RETRY_RATE,
  DEFAULT_MAX_RETRIES,
  DEFAULT_PRICE_PER_SERP_USD,
  DEPTH_MAX,
  DEPTH_MIN,
  POINT_RADIUS_MM_MAX,
  POINT_RADIUS_MM_MIN,
  RESULTS_PER_SERP,
} from "@/lib/scan-defaults";

const sessionSchema = z.object({
  id: z.number().int().positive(),
  plannedAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "plannedAt must be HH:MM"),
});

const keywordSchema = z.object({
  term: z.string().trim().min(1),
  type: z.enum(keywordType.enumValues),
  samples: z.number().int().positive().default(1),
});

export const verifiedAddressSchema = z.object({
  street: z.string().trim().min(2),
  houseNumber: z.string().trim().min(1),
  postalCode: z.string().regex(/^\d{5}$/, "postalCode must be 5 digits"),
  city: z.string().trim().min(2),
});

export const targetLocalBusinessSchema = z
  .object({
    /** Short name for reports, e.g. the town of the location. */
    label: z.string().trim().min(1).optional(),
    cid: z.string().regex(/^\d+$/, "cid must be digits").optional(),
    googleId: z.string().regex(/^\/[gm]\/[0-9a-z_]+$/, "googleId must look like /g/…").optional(),
    profileName: z.string().trim().min(1).optional(),
    address: verifiedAddressSchema.optional(),
    source: z.string().trim().min(3, "source of the verified identity is required"),
  })
  .refine((b) => b.cid !== undefined || b.googleId !== undefined || b.profileName !== undefined || b.address !== undefined, "cid, googleId, profileName or address is required");

export const projectSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9-]+$/, "name must be lowercase letters, digits and dashes"),
    centerAgs: z.string().regex(/^\d{8}$/, "centerAgs must be an 8-digit AGS"),
    radiusKm: z.number().positive(),
    populationMin: z.number().int().nonnegative(),
    /** Optional upper population bound (inclusive). */
    populationMax: z.number().int().positive().optional(),
    /**
     * Explicit settlement list (AGS) instead of "nearest first", e.g. for a small
     * pilot with chosen examples. Each must lie in the radius and population
     * bounds; the centre is added by includeCenter.
     */
    settlementAgs: z.array(z.string().regex(/^\d{8}$/)).optional(),
    /** Always scan the centre settlement, whatever its population; it takes one of the maxSettlements slots. */
    includeCenter: z.boolean().default(false),
    /**
     * Brand words of the target (e.g. "Beispielmiet"). A Local Pack entry carrying
     * the brand but not the verified profile name is shown as another location
     * of the brand, never matched to the target location.
     */
    brandNames: z.array(z.string().trim().min(2)).default([]),
    maxSettlements: z.number().int().positive(),
    device: z.enum(device.enumValues),
    depth: z.number().int().min(DEPTH_MIN).max(DEPTH_MAX),
    pointRadiusMm: z.number().int().min(POINT_RADIUS_MM_MIN).max(POINT_RADIUS_MM_MAX),
    keywords: z.array(keywordSchema).min(1),
    targetDomains: z.array(z.string()).default([]),
    /**
     * The target business in Google's local results, from a verified source
     * (never guessed from the domain or company name); `source` says where.
     * `cid` and `googleId` ("/g/…") listed together in one entry are the
     * evidence that they are the same profile. `profileName` alone never
     * matches (RULES_V0 section 10). `address` is the verified full address.
     */
    targetLocalBusinesses: z.array(targetLocalBusinessSchema).default([]),
    sessions: z.array(sessionSchema).min(1),
  })
  .superRefine((p, ctx) => {
    const terms = p.keywords.map((k) => k.term.toLowerCase());
    if (new Set(terms).size !== terms.length) {
      ctx.addIssue({ code: "custom", path: ["keywords"], message: "duplicate keyword term" });
    }
    const ids = p.sessions.map((s) => s.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["sessions"], message: "duplicate session id" });
    }
    // Sample n runs in session n, so every sample needs its own session.
    const maxSamples = Math.max(...p.keywords.map((k) => k.samples));
    for (let n = 1; n <= maxSamples; n++) {
      if (!ids.includes(n)) {
        ctx.addIssue({
          code: "custom",
          path: ["sessions"],
          message: `sample ${n} needs a session with id ${n}`,
        });
      }
    }
  });

export type Project = z.infer<typeof projectSchema>;
export type ProjectInput = z.input<typeof projectSchema>;

export function parseProject(input: unknown): Project {
  return projectSchema.parse(input);
}

/** A settlement that will be scanned; coordinates are required. */
export interface PlannedSettlement {
  ags: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Task {
  /** Filesystem-safe and unique within a scan: `<ags>-k<keyword#>-s<sample>`. */
  taskKey: string;
  ags: string;
  settlementName: string;
  lat: number;
  lng: number;
  keyword: string;
  keywordType: Project["keywords"][number]["type"];
  sample: number;
  session: number;
  plannedAt: string;
}

/** Sample n of every keyword belongs to session n. */
export function sessionForSample(sample: number): number {
  return sample;
}

export function buildTasks(project: Project, settlements: readonly PlannedSettlement[]): Task[] {
  const plannedAtBySession = new Map(project.sessions.map((s) => [s.id, s.plannedAt]));
  const tasks: Task[] = [];
  for (const s of settlements) {
    project.keywords.forEach((k, i) => {
      for (let sample = 1; sample <= k.samples; sample++) {
        const session = sessionForSample(sample);
        const plannedAt = plannedAtBySession.get(session);
        if (plannedAt === undefined) throw new Error(`no session ${session} for sample ${sample}`);
        tasks.push({
          taskKey: `${s.ags}-k${i + 1}-s${sample}`,
          ags: s.ags,
          settlementName: s.name,
          lat: s.lat,
          lng: s.lng,
          keyword: k.term,
          keywordType: k.type,
          sample,
          session,
          plannedAt,
        });
      }
    });
  }
  return tasks;
}

export function tasksForSession(tasks: readonly Task[], session: number): Task[] {
  return tasks.filter((t) => t.session === session);
}

export interface CostOptions {
  pricePerSerpUsd?: number;
  maxRetries?: number;
  expectedRetryRate?: number;
}

export interface CostEstimate {
  tasks: number;
  serpsPerTask: number;
  pricePerSerpUsd: number;
  costPerAttemptUsd: number;
  maxAttempts: number;
  expectedRetryRate: number;
  expectedUsd: number;
  worstCaseUsd: number;
}

/** Rounds to 1e-9 USD so float noise never flips a cap comparison. */
export function roundUsd(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function serpsForDepth(depth: number): number {
  return Math.ceil(depth / RESULTS_PER_SERP);
}

export function estimateCost(taskCount: number, depth: number, options: CostOptions = {}): CostEstimate {
  const pricePerSerpUsd = options.pricePerSerpUsd ?? DEFAULT_PRICE_PER_SERP_USD;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const expectedRetryRate = options.expectedRetryRate ?? DEFAULT_EXPECTED_RETRY_RATE;
  if (!(pricePerSerpUsd > 0)) throw new Error(`pricePerSerpUsd must be > 0, got ${pricePerSerpUsd}`);
  if (!(Number.isInteger(maxRetries) && maxRetries >= 0)) {
    throw new Error(`maxRetries must be a non-negative integer, got ${maxRetries}`);
  }
  if (!(expectedRetryRate >= 0)) throw new Error(`expectedRetryRate must be >= 0, got ${expectedRetryRate}`);

  const serpsPerTask = serpsForDepth(depth);
  const costPerAttemptUsd = roundUsd(serpsPerTask * pricePerSerpUsd);
  const maxAttempts = 1 + maxRetries;
  return {
    tasks: taskCount,
    serpsPerTask,
    pricePerSerpUsd,
    costPerAttemptUsd,
    maxAttempts,
    expectedRetryRate,
    expectedUsd: roundUsd(taskCount * costPerAttemptUsd * (1 + expectedRetryRate)),
    worstCaseUsd: roundUsd(taskCount * costPerAttemptUsd * maxAttempts),
  };
}

export type CapDecision =
  | { status: "ok"; maxUsd: number }
  /** Allowed to start; the budget ledger enforces the cap during the run. */
  | { status: "warn_worst_case"; maxUsd: number }
  | { status: "rejected"; maxUsd: number };

export function checkCap(estimate: CostEstimate, maxUsd: number): CapDecision {
  if (!(maxUsd > 0)) throw new Error(`SCAN_MAX_USD must be > 0, got ${maxUsd}`);
  if (estimate.expectedUsd > maxUsd) return { status: "rejected", maxUsd };
  if (estimate.worstCaseUsd > maxUsd) return { status: "warn_worst_case", maxUsd };
  return { status: "ok", maxUsd };
}

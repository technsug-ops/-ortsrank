/**
 * Rules v0 (docs/RULES_V0.md 0.2): deterministic findings from SERP
 * measurements. No LLM, no numbers outside this code. Every finding has a
 * fixed evidence level and carries the measurements it rests on.
 */
import type { actionBucket, actionType, evidenceLevel, findingKind } from "@/db/schema";
import { matchesDomain, normalizeDomain } from "@/lib/dataforseo/parse";
import {
  AD_MIN_SESSIONS,
  COVERAGE_MIN_SHARE,
  LOCAL_PACK_GAP_ENABLED,
  LOCAL_PACK_GAP_LABELS,
  LOCAL_PACK_GAP_MIN_COMPETITORS,
  NON_COMPETITOR_LABELS,
  ORGANIC_GAP_LABELS,
  ORGANIC_GAP_MIN_COMPETITORS,
  ORGANIC_TOP,
  PRIORITY_GAP_PARTS,
  PRIORITY_MAX_ACTIONS,
  PRIORITY_WEIGHTS,
  RULES_VERSION,
  type CompetitorLabel,
} from "@/lib/rules/config";
import type { Measurement, PlannedSettlement, ScanData } from "@/lib/rules/measurements";
import { deDate, deList, deNumber, fill, reportText as T } from "@/lib/rules/text";

export type Labels = ReadonlyMap<string, CompetitorLabel>;

/**
 * Target business in the Local Pack, per measurement (RULES_V0 section 10):
 * matched (by cid or exact profile name) · match_unverified (no verified
 * identity, similar but different name, duplicate name, or target domain
 * without matching identity) · not_found_in_pack (pack shown, no entry with
 * the profile name) · no_local_pack · not_measurable (items without name).
 */
export type LocalPackStatus = "matched" | "brand_other_location" | "match_unverified" | "not_found_in_pack" | "no_local_pack" | "not_measurable";
export type LocalPackMethod = "cid" | "profile_name_exact" | null;

export interface LocalPackResult {
  status: LocalPackStatus;
  rank: number | null;
  method: LocalPackMethod;
  /** Business name exactly as returned by the provider (matched or causing the doubt). */
  rawTitle: string | null;
  reason: string | null;
}

export interface TargetIdentity {
  domains: readonly string[];
  cids: readonly string[];
  profileNames: readonly string[];
  /** Brand words; entries carrying them but not the profile name are other locations of the brand. */
  brandNames?: readonly string[];
}

/** True if the brand appears as a whole word (or word sequence) in the name. */
export function hasBrand(name: string, brand: string): boolean {
  const spaced = (s: string) => ` ${normalizeBusinessName(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  return spaced(name).includes(spaced(brand));
}

export interface EvidenceRef {
  runId: string;
  taskKey: string;
  rawPath: string;
  datetime: string | null;
  coordinate: string;
  device: string;
  session: number;
}

export interface Finding {
  id: string;
  rule: "organic_gap" | "local_pack_gap" | "competitor_coverage" | "ad_observation" | "review_priority";
  kind: (typeof findingKind.enumValues)[number];
  evidenceLevel: (typeof evidenceLevel.enumValues)[number];
  score: number;
  dataSources: string[];
  ags: string | null;
  settlement: string | null;
  keyword: string | null;
  competitorDomain: string | null;
  text: string;
  limits: string[];
  evidence: { measurements: EvidenceRef[]; details: Record<string, unknown> };
}

export interface ActionProposal {
  findingId: string;
  type: (typeof actionType.enumValues)[number];
  bucket: (typeof actionBucket.enumValues)[number];
  text: string;
}

export interface StatusCell {
  ags: string;
  settlement: string;
  keyword: string;
  plannedSamples: number;
  validSamples: number;
  failedSamples: number;
  organic: string;
  localPack: string;
  ads: string;
  /** Per measurement: Local Pack status, matching method and the raw business name. */
  localPackDetails: (LocalPackResult & { taskKey: string })[];
}

/**
 * Why a rule did or did not produce a finding for a cell, so that
 * "could not be evaluated (missing information)" and "evaluated, conditions
 * not met" stay apart in reports.
 */
export interface RuleCheck {
  rule: Finding["rule"];
  ags: string;
  keyword: string | null;
  status: "finding" | "not_met" | "not_evaluable" | "disabled";
  reason: string | null;
}

export interface Evaluation {
  rulesVersion: string;
  ruleChecks: RuleCheck[];
  labelsApproved: boolean;
  scanId: string;
  plannedSettlements: number;
  statusTable: StatusCell[];
  findings: Finding[];
  actions: ActionProposal[];
  manualReview: string[];
  priorityIntro: string | null;
}

// ── Per-measurement helpers ─────────────────────────────────────────────

const ref = (m: Measurement): EvidenceRef => ({
  runId: m.runId,
  taskKey: m.taskKey,
  rawPath: m.rawPath,
  datetime: m.datetime,
  coordinate: m.coordinate,
  device: m.device,
  session: m.session,
});

const isTarget = (domain: string | null, targets: readonly string[]) => targets.some((t) => matchesDomain(domain, t));

export function targetOrganicBest(m: Measurement, targets: readonly string[]): number | null {
  const ranks = m.rows.filter((r) => r.type === "organic" && isTarget(r.domain, targets)).map((r) => r.rank);
  return ranks.length ? Math.min(...ranks) : null;
}

/** Distinct competitor domains in the organic top 10 with one of the given labels. */
export function organicTopCompetitors(m: Measurement, targets: readonly string[], labels: Labels, wanted: readonly CompetitorLabel[]): string[] {
  const out = new Set<string>();
  for (const r of m.rows) {
    if (r.type !== "organic" || r.rank > ORGANIC_TOP || !r.domain || isTarget(r.domain, targets)) continue;
    const label = labels.get(r.domain);
    if (label && wanted.includes(label)) out.add(r.domain);
  }
  return [...out];
}

/** Case, Unicode (NFKC) and whitespace only; no word or punctuation removal. */
export function normalizeBusinessName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

const letters = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "");
const words = (s: string) => new Set(s.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3));

/**
 * Used only to downgrade a non-matching name to "unverified" (never to
 * match): substring either way, same letters and digits once punctuation
 * and spaces are ignored, or at least two shared words of 3+ characters.
 */
export function isSimilarName(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  if (letters(a) === letters(b)) return true;
  const wb = words(b);
  return [...words(a)].filter((w) => wb.has(w)).length >= 2;
}

const result = (status: LocalPackStatus, extra: Partial<LocalPackResult> = {}): LocalPackResult => ({
  status,
  rank: null,
  method: null,
  rawTitle: null,
  reason: null,
  ...extra,
});

export function localPackStatus(m: Measurement, target: TargetIdentity): LocalPackResult {
  const items = m.rows.filter((r) => r.type === "local_pack");
  if (items.length === 0) return result("no_local_pack");

  const byCid = items.find((r) => r.cid && target.cids.includes(r.cid));
  if (byCid) return result("matched", { rank: byCid.rank, method: "cid", rawTitle: byCid.title });

  const wanted = target.profileNames.map(normalizeBusinessName);
  const exact = items.filter((r) => r.title && wanted.includes(normalizeBusinessName(r.title)));
  if (exact.length > 1) return result("match_unverified", { reason: "duplicate_name", rawTitle: exact[0].title });
  if (exact.length === 1) return result("matched", { rank: exact[0].rank, method: "profile_name_exact", rawTitle: exact[0].title });

  // Another location of the same brand: shown on its own, never matched to the target location.
  const brand = items.find((r) => r.title && (target.brandNames ?? []).some((b) => hasBrand(r.title!, b)));
  if (brand) return result("brand_other_location", { rank: brand.rank, rawTitle: brand.title, reason: "brand_without_profile_name" });

  if (target.profileNames.length === 0) {
    return result("match_unverified", { reason: target.cids.length ? "no_cid_in_response" : "no_verified_identity" });
  }
  const untitled = items.filter((r) => !r.title || !r.title.trim());
  if (untitled.length) return result("not_measurable", { reason: "items_without_name" });

  // Similar but different names only downgrade to "unverified", they never match.
  const similar = items.find((r) => wanted.some((w) => isSimilarName(normalizeBusinessName(r.title!), w)));
  if (similar) return result("match_unverified", { reason: "similar_name", rawTitle: similar.title });
  const byDomain = items.find((r) => isTarget(r.domain, target.domains));
  if (byDomain) return result("match_unverified", { reason: "target_domain_without_identity", rawTitle: byDomain.title });

  return result("not_found_in_pack");
}

function localPackCompetitors(m: Measurement, targets: readonly string[], labels: Labels, wanted: readonly CompetitorLabel[]): string[] {
  const out = new Set<string>();
  for (const r of m.rows) {
    if (r.type !== "local_pack" || !r.domain || isTarget(r.domain, targets)) continue;
    const label = labels.get(r.domain);
    if (label && wanted.includes(label)) out.add(r.domain);
  }
  return [...out];
}

const hasAds = (m: Measurement) => m.rows.some((r) => r.type === "ad");

/** Organic results actually returned; live SERPs give ~15 even when depth is 20. */
export const organicCount = (m: Measurement) => Math.max(0, ...m.rows.filter((r) => r.type === "organic").map((r) => r.rank));

/** "18 Ergebnisse" or "18, 19 und 19 Ergebnisse": per measurement, never the requested depth. */
function countsText(ms: readonly Measurement[]): string {
  const counts = ms.map(organicCount);
  return counts.length === 1 ? fill(T.status.organicCount, { count: counts[0] }) : fill(T.status.organicCounts, { counts: deList(counts.map(String)) });
}

/** "Not found" names how many organic results each measurement returned. */
function notFoundText(ms: readonly Measurement[]): string {
  return ms.every((m) => organicCount(m) === 0) ? T.status.noOrganic : fill(T.status.notFound, { counts: countsText(ms) });
}

/**
 * Organic cell per measurement: found in k of n (with each rank), and for the
 * others how many organic results were returned. Never only the best rank.
 */
export function organicCellText(ms: readonly Measurement[], targets: readonly string[]): string {
  const ranks = ms.map((m) => targetOrganicBest(m, targets));
  const found = ranks.filter((r): r is number => r !== null);
  const missing = ms.filter((_, i) => ranks[i] === null);
  if (ms.length === 1 && found.length === 1) return fill(T.status.organicOneFound, { rank: found[0] });
  if (found.length === ms.length) return fill(T.status.organicAll, { n: ms.length, ranks: deList(found.map(String)) });
  if (missing.every((m) => organicCount(m) === 0) && found.length === 0) return T.status.noOrganic;
  if (ms.length === 1) return fill(T.status.organicOneNone, { counts: countsText(ms) });
  if (found.length === 0) return fill(T.status.organicNone, { n: ms.length, counts: countsText(ms) });
  const some = missing.length === 1 ? T.status.organicSomeOne : T.status.organicSome;
  return fill(some, { k: found.length, n: ms.length, ranks: deList(found.map(String)), m: missing.length, counts: countsText(missing) });
}

// ── Priority ────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface PriorityInput {
  organicGap: boolean;
  localPackGap: boolean;
  population: number | null;
  maxPopulation: number;
  distanceKm: number;
  radiusKm: number;
}

export type PriorityResult =
  | { score: number; gap: number; population: number; proximity: number }
  | { score: null; reason: "missing_population" };

export function priorityScore(i: PriorityInput): PriorityResult {
  if (!(i.radiusKm > 0)) throw new Error(`radiusKm must be > 0, got ${i.radiusKm}`);
  if (i.population === null) return { score: null, reason: "missing_population" };
  if (!(i.maxPopulation > 0)) throw new Error(`maxPopulation must be > 0, got ${i.maxPopulation}`);
  const gap = clamp01((i.organicGap ? PRIORITY_GAP_PARTS.organic : 0) + (i.localPackGap ? PRIORITY_GAP_PARTS.localPack : 0));
  const population = clamp01(i.population / i.maxPopulation);
  const proximity = clamp01(1 - i.distanceKm / i.radiusKm);
  const score = Math.round(100 * (PRIORITY_WEIGHTS.gap * gap + PRIORITY_WEIGHTS.population * population + PRIORITY_WEIGHTS.proximity * proximity));
  return { score, gap, population, proximity };
}

// ── Evaluation ──────────────────────────────────────────────────────────

const labelText = (labels: Labels, domain: string) => labels.get(domain) ?? null;

export interface EvaluateOptions {
  /** Off in the pilot (RULES_V0 section 10). */
  localPackGap?: boolean;
  /** False when labels come from an unapproved draft: wording and limits say so. */
  labelsApproved?: boolean;
}

export function evaluate(scan: ScanData, labels: Labels, options: EvaluateOptions = {}): Evaluation {
  const localPackGapEnabled = options.localPackGap ?? LOCAL_PACK_GAP_ENABLED;
  const labelsApproved = options.labelsApproved ?? true;
  const identity: TargetIdentity = {
    domains: scan.targetDomains.map(normalizeDomain),
    cids: scan.targetCids,
    profileNames: scan.targetProfileNames,
    brandNames: scan.brandNames,
  };
  const targets = scan.targetDomains.map(normalizeDomain);
  // Without a target domain nothing can be "not found": organic findings about the target are skipped.
  const hasTarget = targets.length > 0;
  const targetName = deList(targets);
  const measurementsText = (n: number, planned: number, none = false) =>
    n === planned
      ? fill(none ? T.measurements.noneAll : T.measurements.all, { n })
      : fill(none ? T.measurements.nonePartial : T.measurements.partial, { n, planned });
  const findings: Finding[] = [];
  const actions: ActionProposal[] = [];
  const settlementByAgs = new Map(scan.settlements.map((s) => [s.ags, s]));
  const mainKeywords = scan.keywords.filter((k) => k.type === "main").map((k) => k.term);

  const cell = (ags: string, keyword: string) =>
    scan.measurements.filter((m) => m.ags === ags && m.keyword === keyword).sort((a, b) => a.session - b.session);
  const plannedCount = (ags: string, keyword: string) => scan.plannedTasks.filter((t) => t.ags === ags && t.keyword === keyword).length;
  const failedCount = (ags: string, keyword: string) => scan.failed.filter((f) => f.ags === ags && f.keyword === keyword).length;

  // Status table: every planned settlement × keyword.
  const statusTable: StatusCell[] = [];
  for (const s of scan.settlements) {
    for (const k of scan.keywords) {
      const ms = cell(s.ags, k.term);
      const planned = plannedCount(s.ags, k.term);
      if (planned === 0) continue;
      let organic = T.status.notMeasured;
      let localPack = T.status.notMeasured;
      let ads = T.status.notMeasured;
      let localPackDetails: StatusCell["localPackDetails"] = [];
      if (ms.length) {
        organic = hasTarget ? organicCellText(ms, targets) : T.status.targetUndefined;
        const lp = ms.map((m) => ({ taskKey: m.taskKey, ...localPackStatus(m, identity) }));
        localPackDetails = lp;
        const matched = lp.filter((x) => x.status === "matched").sort((a, b) => a.rank! - b.rank!);
        localPack = matched.length
          ? fill(matched[0].method === "cid" ? T.status.lpMatched : T.status.lpMatchedName, { rank: matched[0].rank! })
          : lp.some((x) => x.status === "brand_other_location")
            ? fill(T.status.lpBrandOther, {
                rank: lp.find((x) => x.status === "brand_other_location")!.rank!,
                title: lp.find((x) => x.status === "brand_other_location")!.rawTitle ?? "",
              })
          : lp.some((x) => x.status === "match_unverified")
            ? T.status.lpUnverified
            : lp.some((x) => x.status === "not_measurable")
              ? T.status.lpNotMeasurable
              : lp.some((x) => x.status === "not_found_in_pack")
                ? T.status.lpNameNotFound
                : T.status.lpNone;
        // Back-to-back technical trials say nothing about ad frequency: no ratio shown.
        const sessionMs = ms.filter((m) => m.samplingMode === "sessions");
        ads = sessionMs.length ? `${sessionMs.filter(hasAds).length}/${sessionMs.length}` : T.status.adsNotEvaluated;
      }
      statusTable.push({
        ags: s.ags,
        settlement: s.name,
        keyword: k.term,
        plannedSamples: planned,
        validSamples: ms.length,
        failedSamples: failedCount(s.ags, k.term),
        organic,
        localPack,
        ads,
        localPackDetails,
      });
    }
  }

  // Rules 1, 2, 4 per settlement × main keyword.
  const ruleChecks: RuleCheck[] = [];
  const gaps = new Map<string, { organic: boolean; localPack: boolean; refs: EvidenceRef[] }>();
  /** `${ags}|${keyword}` with an organic_gap: hypotheses must rest on the same settlement and keyword. */
  const organicGapKeys = new Set<string>();
  for (const s of scan.settlements) {
    for (const keyword of mainKeywords) {
      const ms = cell(s.ags, keyword);
      if (ms.length === 0) continue;
      const g = gaps.get(s.ags) ?? { organic: false, localPack: false, refs: [] };

      // 1. organic_gap: in every valid measurement, target outside the top 10 and ≥ 2 local/regional competitors inside.
      const perMeasurement = ms.map((m) => ({ m, best: targetOrganicBest(m, targets), competitors: organicTopCompetitors(m, targets, labels, ORGANIC_GAP_LABELS) }));
      const planned = plannedCount(s.ags, keyword);
      if (hasTarget && perMeasurement.every((x) => (x.best === null || x.best > ORGANIC_TOP) && x.competitors.length >= ORGANIC_GAP_MIN_COMPETITORS)) {
        const found = perMeasurement.map((x) => x.best).filter((r): r is number => r !== null);
        const status = found.length ? organicCellText(ms, targets) : notFoundText(ms);
        const id = `organic_gap:${s.ags}:${keyword}`;
        findings.push({
          id,
          rule: "organic_gap",
          kind: "opportunity",
          evidenceLevel: "observation",
          score: 0,
          dataSources: ["serp_raw"],
          ags: s.ags,
          settlement: s.name,
          keyword,
          competitorDomain: null,
          text: fill(T.organicGap.text, {
            settlement: s.name,
            target: targetName,
            keyword,
            measurements: measurementsText(ms.length, planned),
            status,
            perMeasurement: perMeasurement
              .map((x) => fill(T.organicGap.measurement, { sample: x.m.session, date: deDate(x.m.datetime), competitors: deList(x.competitors) }))
              .join("; "),
          }),
          limits: labelsApproved ? [] : [T.organicGap.labelsDraft],
          evidence: {
            measurements: ms.map(ref),
            details: { labelsApproved, perMeasurement: perMeasurement.map((x) => ({ taskKey: x.m.taskKey, targetBestRank: x.best, competitors: x.competitors })) },
          },
        });
        actions.push({ findingId: id, type: "review", bucket: "website", text: fill(T.organicGap.action, { keyword, settlement: s.name }) });
        g.organic = true;
        organicGapKeys.add(`${s.ags}|${keyword}`);
        g.refs.push(...ms.map(ref));
        ruleChecks.push({ rule: "organic_gap", ags: s.ags, keyword, status: "finding", reason: null });
      } else if (!hasTarget) {
        ruleChecks.push({ rule: "organic_gap", ags: s.ags, keyword, status: "not_evaluable", reason: "no_target_domain" });
      } else if (perMeasurement.some((x) => x.best !== null && x.best <= ORGANIC_TOP)) {
        ruleChecks.push({ rule: "organic_gap", ags: s.ags, keyword, status: "not_met", reason: "target_in_top_10" });
      } else {
        // Fewer than 2 labelled local/regional competitors in some measurement: unlabelled
        // domains in its top 10 could change that, so the rule cannot be decided yet.
        const undecided = perMeasurement.some((x) => {
          if (x.competitors.length >= ORGANIC_GAP_MIN_COMPETITORS) return false;
          const unlabelled = new Set(x.m.rows.filter((r) => r.type === "organic" && r.rank <= ORGANIC_TOP && r.domain && !isTarget(r.domain, targets) && !labels.has(r.domain)).map((r) => r.domain));
          return x.competitors.length + unlabelled.size >= ORGANIC_GAP_MIN_COMPETITORS;
        });
        ruleChecks.push(
          undecided
            ? { rule: "organic_gap", ags: s.ags, keyword, status: "not_evaluable", reason: "unlabelled_competitors_in_top_10" }
            : { rule: "organic_gap", ags: s.ags, keyword, status: "not_met", reason: "fewer_than_2_local_competitors" },
        );
      }

      // 2. local_pack_gap (off in the pilot): every measurement without the target, a shown pack with a local competitor.
      const lp = ms.map((m) => ({ m, ...localPackStatus(m, identity), competitors: localPackCompetitors(m, targets, labels, LOCAL_PACK_GAP_LABELS) }));
      const noMatch = lp.every((x) => x.status === "not_found_in_pack" || x.status === "no_local_pack");
      const withCompetitor = lp.some((x) => x.status === "not_found_in_pack" && x.competitors.length >= LOCAL_PACK_GAP_MIN_COMPETITORS);
      if (!localPackGapEnabled) ruleChecks.push({ rule: "local_pack_gap", ags: s.ags, keyword, status: "disabled", reason: "off_in_pilot" });
      if (localPackGapEnabled && noMatch && withCompetitor) {
        const id = `local_pack_gap:${s.ags}:${keyword}`;
        const competitors = [...new Set(lp.flatMap((x) => x.competitors))];
        const withoutPack = lp.filter((x) => x.status === "no_local_pack").length;
        findings.push({
          id,
          rule: "local_pack_gap",
          kind: "opportunity",
          evidenceLevel: "observation",
          score: 0,
          dataSources: ["serp_raw"],
          ags: s.ags,
          settlement: s.name,
          keyword,
          competitorDomain: null,
          text: fill(T.localPackGap.text, {
            settlement: s.name,
            keyword,
            measurements: measurementsText(ms.length, planned, true),
            packs: withoutPack === 0
              ? fill(T.localPackGap.packsAll, { n: ms.length })
              : fill(T.localPackGap.packsSome, { withPack: ms.length - withoutPack, withoutPack }),
            competitors: deList(competitors),
          }),
          limits: [T.localPackGap.limit],
          evidence: {
            measurements: ms.map(ref),
            details: { perMeasurement: lp.map((x) => ({ taskKey: x.m.taskKey, status: x.status, method: x.method, rawTitle: x.rawTitle, competitors: x.competitors })) },
          },
        });
        actions.push({ findingId: id, type: "review", bucket: "google_profile", text: T.localPackGap.action });
        g.localPack = true;
        g.refs.push(...ms.map(ref));
      }
      gaps.set(s.ags, g);

      // 4. ad_observation: sessions sampling, at least 3 distinct sessions with a valid measurement.
      const bySession = new Map<number, Measurement>();
      for (const m of ms) if (m.samplingMode === "sessions" && !bySession.has(m.session)) bySession.set(m.session, m);
      const sessionMs = [...bySession.values()];
      if (sessionMs.length < AD_MIN_SESSIONS) {
        ruleChecks.push({
          rule: "ad_observation",
          ags: s.ags,
          keyword,
          status: "not_evaluable",
          reason: sessionMs.length === 0 && ms.length > 0 ? "technical_validation_only" : "fewer_than_3_sessions",
        });
      } else {
        ruleChecks.push({ rule: "ad_observation", ags: s.ags, keyword, status: "finding", reason: null });
      }
      if (sessionMs.length >= AD_MIN_SESSIONS) {
        const k = sessionMs.filter(hasAds).length;
        const n = sessionMs.length;
        const dates = deList([...new Set(sessionMs.map((m) => deDate(m.datetime)))]);
        const device = T.status.device[scan.device];
        const id = `ad_observation:${s.ags}:${keyword}`;
        findings.push({
          id,
          rule: "ad_observation",
          kind: "opportunity",
          evidenceLevel: "observation",
          score: Math.round((100 * k) / n),
          dataSources: ["serp_raw"],
          ags: s.ags,
          settlement: s.name,
          keyword,
          competitorDomain: null,
          text: fill(k === 0 ? T.adObservation.none : T.adObservation.seen, { settlement: s.name, keyword, k, n, dates, device }),
          limits: [],
          evidence: { measurements: sessionMs.map(ref), details: { sessionsWithAds: k, sessions: n } },
        });
        if (k === 0 && organicGapKeys.has(`${s.ags}|${keyword}`)) {
          const hid = `ad_observation:hypothesis:${s.ags}:${keyword}`;
          findings.push({
            id: hid,
            rule: "ad_observation",
            kind: "opportunity",
            evidenceLevel: "hypothesis",
            score: 0,
            dataSources: ["serp_raw"],
            ags: s.ags,
            settlement: s.name,
            keyword,
            competitorDomain: null,
            text: fill(T.adObservation.hypothesis, { keyword, settlement: s.name }),
            limits: [],
            evidence: { measurements: sessionMs.map(ref), details: { basedOn: [id, `organic_gap:${s.ags}:${keyword}`] } },
          });
          actions.push({ findingId: hid, type: "verification", bucket: "ads", text: fill(T.adObservation.action, { keyword, settlement: s.name }) });
        }
      }
    }
  }

  // 3. competitor_coverage per main keyword.
  for (const keyword of mainKeywords) {
    const measured = scan.settlements.filter((s) => cell(s.ags, keyword).length > 0);
    const planned = scan.settlements.filter((s) => plannedCount(s.ags, keyword) > 0).length;
    if (measured.length === 0) continue;
    type PerSettlement = { n: number; any: Set<string>; organic: Set<string>; localPack: Set<string> };
    const seen = new Map<string, { organic: Set<string>; localPack: Set<string>; refs: EvidenceRef[]; per: Map<string, PerSettlement> }>();
    for (const s of measured) {
      const ms = cell(s.ags, keyword);
      for (const m of ms) {
        for (const r of m.rows) {
          if (!r.domain || isTarget(r.domain, targets)) continue;
          const inOrganic = r.type === "organic" && r.rank <= ORGANIC_TOP;
          const inPack = r.type === "local_pack";
          if (!inOrganic && !inPack) continue;
          const e = seen.get(r.domain) ?? { organic: new Set<string>(), localPack: new Set<string>(), refs: [] as EvidenceRef[], per: new Map<string, PerSettlement>() };
          (inOrganic ? e.organic : e.localPack).add(s.ags);
          if (!e.refs.some((x) => x.taskKey === m.taskKey)) e.refs.push(ref(m));
          const p = e.per.get(s.ags) ?? { n: ms.length, any: new Set(), organic: new Set(), localPack: new Set() };
          p.any.add(m.taskKey);
          (inOrganic ? p.organic : p.localPack).add(m.taskKey);
          e.per.set(s.ags, p);
          seen.set(r.domain, e);
        }
      }
    }
    const rows = [...seen].map(([domain, e]) => ({ domain, ...e, any: new Set([...e.organic, ...e.localPack]) }));
    rows.sort((a, b) => b.any.size - a.any.size || a.domain.localeCompare(b.domain));
    for (const r of rows) {
      const share = r.any.size / measured.length;
      if (share < COVERAGE_MIN_SHARE) continue;
      const label = labelText(labels, r.domain);
      const id = `competitor_coverage:${r.domain}:${keyword}`;
      findings.push({
        id,
        rule: "competitor_coverage",
        kind: "threat",
        evidenceLevel: "observation",
        score: Math.round(100 * share),
        dataSources: ["serp_raw"],
        ags: null,
        settlement: null,
        keyword,
        competitorDomain: r.domain,
        text: [
          fill(T.competitorCoverage.text, {
            planned,
            measured: measured.length,
            keyword,
            domain: r.domain,
            any: r.any.size,
            organic: r.organic.size,
            localPack: r.localPack.size,
          }),
          fill(T.competitorCoverage.observedIn, {
            list: [...r.per]
              .map(([ags, p]) => ({ s: settlementByAgs.get(ags)!, p }))
              .sort((a, b) => a.s.distanceKm - b.s.distanceKm)
              .map(({ s, p }) => fill(T.competitorCoverage.perSettlement, { settlement: s.name, k: p.any.size, n: p.n, o: p.organic.size, l: p.localPack.size }))
              .join("; "),
          }),
          label ? fill(labelsApproved ? T.competitorCoverage.label : T.competitorCoverage.labelDraft, { label }) : T.competitorCoverage.unlabeled,
        ].join(" "),
        limits: [T.competitorCoverage.meaning],
        evidence: {
          measurements: r.refs,
          details: {
            planned,
            measured: measured.length,
            organic: [...r.organic].sort(),
            localPack: [...r.localPack].sort(),
            observedAtLeastOnce: [...r.any].sort(),
            perSettlement: Object.fromEntries([...r.per].map(([ags, p]) => [ags, { validMeasurements: p.n, observed: p.any.size, organic: p.organic.size, localPack: p.localPack.size }])),
            label,
            listedSeparately: label !== null && NON_COMPETITOR_LABELS.includes(label),
          },
        },
      });
    }
  }

  // 5. review_priority over settlements with a gap.
  const manualReview: string[] = [];
  const maxPopulation = Math.max(0, ...scan.settlements.map((s) => s.population ?? 0));
  const ranked: { s: PlannedSettlement; p: Extract<PriorityResult, { score: number }>; refs: EvidenceRef[] }[] = [];
  for (const [ags, g] of gaps) {
    if (!g.organic && !g.localPack) continue;
    const s = settlementByAgs.get(ags)!;
    const p = priorityScore({ organicGap: g.organic, localPackGap: g.localPack, population: s.population, maxPopulation: maxPopulation || 1, distanceKm: s.distanceKm, radiusKm: scan.radiusKm });
    if (p.score === null) manualReview.push(fill(T.reviewPriority.manual, { settlement: s.name }));
    else ranked.push({ s, p, refs: g.refs });
  }
  ranked.sort((a, b) => b.p.score - a.p.score || a.s.distanceKm - b.s.distanceKm);
  ranked.forEach(({ s, p, refs }, i) => {
    const id = `review_priority:${s.ags}`;
    findings.push({
      id,
      rule: "review_priority",
      kind: "action",
      evidenceLevel: "inference",
      score: p.score,
      dataSources: ["serp_raw", "destatis-gv-isys"],
      ags: s.ags,
      settlement: s.name,
      keyword: null,
      competitorDomain: null,
      text: fill(T.reviewPriority.item, {
        position: i + 1,
        settlement: s.name,
        score: p.score,
        gap: deNumber(p.gap),
        population: deNumber(p.population),
        proximity: deNumber(p.proximity),
      }),
      limits: [T.reviewPriority.intro],
      evidence: { measurements: refs, details: { ...p, population: s.population, distanceKm: s.distanceKm, radiusKm: scan.radiusKm, weights: PRIORITY_WEIGHTS } },
    });
    if (i < PRIORITY_MAX_ACTIONS) actions.push({ findingId: id, type: "review", bucket: "monitoring", text: fill(T.reviewPriority.action, { settlement: s.name }) });
  });
  // Gap findings carry their settlement's priority score.
  const scoreByAgs = new Map(ranked.map((r) => [r.s.ags, r.p.score]));
  for (const f of findings) if ((f.rule === "organic_gap" || f.rule === "local_pack_gap") && f.ags) f.score = scoreByAgs.get(f.ags) ?? 0;

  return {
    rulesVersion: RULES_VERSION,
    ruleChecks,
    labelsApproved,
    scanId: scan.scanId,
    plannedSettlements: scan.settlements.length,
    statusTable,
    findings,
    actions,
    manualReview,
    priorityIntro: ranked.length || manualReview.length ? T.reviewPriority.intro : null,
  };
}

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

export type LocalPackStatus = "matched" | "not_matched" | "no_local_pack" | "match_unverified";

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
}

export interface Evaluation {
  rulesVersion: string;
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

export function localPackStatus(m: Measurement, targets: readonly string[], targetCids: readonly string[]): { status: LocalPackStatus; rank: number | null } {
  const items = m.rows.filter((r) => r.type === "local_pack");
  if (items.length === 0) return { status: "no_local_pack", rank: null };
  if (targetCids.length === 0) return { status: "match_unverified", rank: null };
  const byCid = items.find((r) => r.cid && targetCids.includes(r.cid));
  if (byCid) return { status: "matched", rank: byCid.rank };
  // The target's domain without a verified cid: some business claims the site, identity unclear.
  if (items.some((r) => isTarget(r.domain, targets))) return { status: "match_unverified", rank: null };
  // An item without cid could be the target: absence cannot be concluded (live responses carry cid: null).
  if (items.some((r) => !r.cid)) return { status: "match_unverified", rank: null };
  return { status: "not_matched", rank: null };
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

/** "Not found" names the smallest organic list of the measurements, never the requested depth. */
function notFoundText(ms: readonly Measurement[]): string {
  const depth = Math.min(...ms.map(organicCount));
  return depth > 0 ? fill(T.status.notFound, { depth }) : T.status.noOrganic;
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

export function evaluate(scan: ScanData, labels: Labels): Evaluation {
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
      if (ms.length) {
        const best = ms.map((m) => targetOrganicBest(m, targets)).filter((r): r is number => r !== null);
        organic = !hasTarget
          ? T.status.targetUndefined
          : best.length
            ? fill(T.status.rank, { rank: Math.min(...best) })
            : notFoundText(ms);
        const lp = ms.map((m) => localPackStatus(m, targets, scan.targetCids));
        const matched = lp.filter((x) => x.status === "matched").map((x) => x.rank!);
        localPack = matched.length
          ? fill(T.status.lpMatched, { rank: Math.min(...matched) })
          : lp.some((x) => x.status === "match_unverified")
            ? T.status.lpUnverified
            : lp.some((x) => x.status === "not_matched")
              ? T.status.lpNotMatched
              : T.status.lpNone;
        ads = `${ms.filter(hasAds).length}/${ms.length}`;
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
      });
    }
  }

  // Rules 1, 2, 4 per settlement × main keyword.
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
        const status = found.length ? fill(T.status.rank, { rank: Math.min(...found) }) : notFoundText(ms);
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
          limits: [],
          evidence: {
            measurements: ms.map(ref),
            details: { perMeasurement: perMeasurement.map((x) => ({ taskKey: x.m.taskKey, targetBestRank: x.best, competitors: x.competitors })) },
          },
        });
        actions.push({ findingId: id, type: "review", bucket: "website", text: fill(T.organicGap.action, { keyword, settlement: s.name }) });
        g.organic = true;
        organicGapKeys.add(`${s.ags}|${keyword}`);
        g.refs.push(...ms.map(ref));
      }

      // 2. local_pack_gap: no matched / unverified measurement, and a shown pack with a local competitor.
      const lp = ms.map((m) => ({ m, ...localPackStatus(m, targets, scan.targetCids), competitors: localPackCompetitors(m, targets, labels, LOCAL_PACK_GAP_LABELS) }));
      const noMatch = lp.every((x) => x.status === "not_matched" || x.status === "no_local_pack");
      const withCompetitor = lp.some((x) => x.status === "not_matched" && x.competitors.length >= LOCAL_PACK_GAP_MIN_COMPETITORS);
      if (noMatch && withCompetitor) {
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
            details: { perMeasurement: lp.map((x) => ({ taskKey: x.m.taskKey, status: x.status, competitors: x.competitors })) },
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
    const seen = new Map<string, { organic: Set<string>; localPack: Set<string>; refs: EvidenceRef[] }>();
    for (const s of measured) {
      for (const m of cell(s.ags, keyword)) {
        for (const r of m.rows) {
          if (!r.domain || isTarget(r.domain, targets)) continue;
          const inOrganic = r.type === "organic" && r.rank <= ORGANIC_TOP;
          const inPack = r.type === "local_pack";
          if (!inOrganic && !inPack) continue;
          const e = seen.get(r.domain) ?? { organic: new Set(), localPack: new Set(), refs: [] };
          (inOrganic ? e.organic : e.localPack).add(s.ags);
          if (!e.refs.some((x) => x.taskKey === m.taskKey)) e.refs.push(ref(m));
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
          label ? fill(T.competitorCoverage.label, { label }) : T.competitorCoverage.unlabeled,
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
    scanId: scan.scanId,
    plannedSettlements: scan.settlements.length,
    statusTable,
    findings,
    actions,
    manualReview,
    priorityIntro: ranked.length || manualReview.length ? T.reviewPriority.intro : null,
  };
}

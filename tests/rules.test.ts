import { describe, expect, it } from "vitest";
import type { SerpRow } from "@/lib/dataforseo/parse";
import { NON_COMPETITOR_LABELS } from "@/lib/rules/config";
import { evaluate, hasBrand, isSimilarName, localPackStatus, normalizeBusinessName, priorityScore, type Labels, type TargetIdentity } from "@/lib/rules/engine";
import type { Measurement, PlannedSettlement, ScanData } from "@/lib/rules/measurements";
import { fill, reportText } from "@/lib/rules/text";

// ── Builders ────────────────────────────────────────────────────────────

const TARGET = "ziel-betrieb.example";
const TARGET_CID = "1000000000000000001";
const KW = "Terrassenüberdachung";

const labels: Labels = new Map([
  ["lokal-a.example", "local"],
  ["lokal-b.example", "local"],
  ["region-c.example", "regional"],
  ["national-d.example", "national"],
  ["portal.example", "portal"],
  ["verzeichnis.example", "directory"],
]);

const org = (rank: number, domain: string): SerpRow => ({ type: "organic", rank, rankAbsolute: rank, domain, url: `https://${domain}/`, title: domain });
const ad = (rank: number, domain: string): SerpRow => ({ type: "ad", rank, rankAbsolute: rank, domain, url: `https://${domain}/`, title: domain, adPosition: "top" });
const lp = (rank: number, domain: string | null, cid: string | null): SerpRow => ({
  type: "local_pack", rank, rankAbsolute: rank, domain, url: null, title: domain ?? "Betrieb", cid, rating: null, votesCount: null, phone: null, isPaid: false,
});

/** Organic list: given domains at ranks 1.., padded with unlabeled fillers to 20. */
function organic(...domains: string[]): SerpRow[] {
  const all = [...domains];
  for (let i = all.length; i < 20; i++) all.push(`fueller-${i + 1}.example`);
  return all.map((d, i) => org(i + 1, d));
}

function m(ags: string, session: number, rows: SerpRow[], over: Partial<Measurement> = {}): Measurement {
  return {
    runId: `run-s${session}`,
    taskKey: `${ags}-k1-s${session}`,
    ags,
    keyword: KW,
    sample: session,
    session,
    samplingMode: "sessions",
    rawPath: `run-s${session}/raw/${ags}-k1-s${session}/attempt-1.json`,
    datetime: `2026-10-2${session} 07:00:00 +00:00`,
    device: "mobile",
    coordinate: "50.1,8.6,200",
    depth: 20,
    rows,
    ...over,
  };
}

function settlement(ags: string, name: string, population: number | null, distanceKm: number): PlannedSettlement {
  return { ags, name, population, distanceKm, lat: 50, lng: 8 };
}

function scan(settlements: PlannedSettlement[], measurements: Measurement[], over: Partial<ScanData> = {}): ScanData {
  const planned = settlements.flatMap((s) => [1, 2, 3].map((session) => ({ taskKey: `${s.ags}-k1-s${session}`, ags: s.ags, keyword: KW, session })));
  return {
    scanId: "scan-test",
    runIds: ["run-s1", "run-s2", "run-s3"],
    project: "test",
    radiusKm: 30,
    depth: 20,
    device: "mobile",
    targetDomains: [TARGET],
    targetCids: [TARGET_CID],
    targetProfileNames: [],
    brandNames: [],
    keywords: [{ term: KW, type: "main", samples: 3 }],
    settlements,
    plannedTasks: planned,
    measurements,
    failed: [],
    ...over,
  };
}

const S1 = settlement("06412000", "Frankfurt am Main", 760000, 0);
const S2 = settlement("06413000", "Offenbach am Main", 133000, 6);
const S3 = settlement("06438009", "Neu-Isenburg", 38000, 6.3);
const S4 = settlement("06436003", "Eschborn", 22000, 8.8);

const byRule = (e: ReturnType<typeof evaluate>, rule: string) => e.findings.filter((f) => f.rule === rule);

// ── organic_gap ─────────────────────────────────────────────────────────

describe("organic_gap", () => {
  it("fires when, in every valid measurement, the target is outside the top 10 and ≥ 2 local/regional competitors are inside", () => {
    const ms = [1, 2, 3].map((s) => m(S2.ags, s, organic("lokal-a.example", "lokal-b.example", ...Array(11).fill(null).map((_, i) => `x${i}.example`), TARGET)));
    const e = evaluate(scan([S2], ms), labels);
    const [f] = byRule(e, "organic_gap");
    expect(f).toMatchObject({ evidenceLevel: "observation", kind: "opportunity", ags: S2.ags });
    expect(f.text).toContain("in 3 von 3 gültigen Messungen nicht unter den ersten 10 organischen Ergebnissen (bestes Ergebnis Platz 14)");
    expect(f.text).toContain("Messung 1 (21.10.2026): lokal-a.example und lokal-b.example");
    expect(e.actions.find((a) => a.findingId === f.id)).toMatchObject({ type: "review", bucket: "website" });
    expect(f.evidence.measurements).toHaveLength(3);
    expect(f.evidence.measurements[0]).toMatchObject({ taskKey: `${S2.ags}-k1-s1`, rawPath: expect.stringContaining("attempt-1.json") });
  });

  it("checks the competitor condition in each measurement separately", () => {
    // 1: a + b (2) · 2: a + c (2) · 3: only a (1) → not every measurement has 2.
    const ms = [
      m(S2.ags, 1, organic("lokal-a.example", "lokal-b.example")),
      m(S2.ags, 2, organic("lokal-a.example", "region-c.example")),
      m(S2.ags, 3, organic("lokal-a.example")),
    ];
    expect(byRule(evaluate(scan([S2], ms), labels), "organic_gap")).toEqual([]);
  });

  it("lists different competitors per measurement when each has two", () => {
    const ms = [m(S2.ags, 1, organic("lokal-a.example", "lokal-b.example")), m(S2.ags, 2, organic("lokal-a.example", "region-c.example"))];
    const [f] = byRule(evaluate(scan([S2], ms), labels), "organic_gap");
    expect(f.text).toContain("Messung 1 (21.10.2026): lokal-a.example und lokal-b.example; Messung 2 (22.10.2026): lokal-a.example und region-c.example");
    expect(f.text).toContain("unter den ersten 20 organischen Ergebnissen nicht gefunden");
  });

  it("does not fire with one competitor, or with national/portal/unlabeled ones", () => {
    const one = [m(S2.ags, 1, organic("lokal-a.example", "national-d.example", "portal.example", "unbekannt.example"))];
    expect(byRule(evaluate(scan([S2], one), labels), "organic_gap")).toEqual([]);
  });

  it("does not fire when the target is in the top 10 in any measurement", () => {
    const ms = [m(S2.ags, 1, organic("lokal-a.example", "lokal-b.example")), m(S2.ags, 2, organic("lokal-a.example", "lokal-b.example", TARGET))];
    expect(byRule(evaluate(scan([S2], ms), labels), "organic_gap")).toEqual([]);
  });

  it("ignores failed tasks: a settlement without valid measurements is 'nicht gemessen' and gets no finding", () => {
    const e = evaluate(
      scan([S2], [], { failed: [1, 2, 3].map((s) => ({ runId: "r", taskKey: `${S2.ags}-k1-s${s}`, ags: S2.ags, keyword: KW, session: s, status: "error" as const, reason: "timeout" })) }),
      labels,
    );
    expect(e.findings).toEqual([]);
    expect(e.statusTable[0]).toMatchObject({ validSamples: 0, failedSamples: 3, plannedSamples: 3, organic: "nicht gemessen", localPack: "nicht gemessen" });
  });
});

// ── local pack (RULES_V0 section 10: profile name, pilot) ───────────────

const PROFILE = "Ziel Betrieb GmbH – Terrassendächer";
const identity = (over: Partial<TargetIdentity> = {}): TargetIdentity => ({ domains: [TARGET], cids: [], profileNames: [PROFILE], ...over });
const named = (rank: number, title: string | null, domain: string | null = null, cid: string | null = null): SerpRow => ({ ...lp(rank, domain, cid), title });

describe("normalizeBusinessName", () => {
  it("normalises case, Unicode and whitespace only", () => {
    expect(normalizeBusinessName("  ZIEL  Betrieb\u00a0GmbH ")).toBe("ziel betrieb gmbh");
    expect(normalizeBusinessName("Ｚiel")).toBe("ziel"); // full-width letter (NFKC)
    expect(normalizeBusinessName("Ziel-Betrieb, GmbH")).toBe("ziel-betrieb, gmbh"); // punctuation kept
  });
});

describe("isSimilarName (downgrade only)", () => {
  it.each([
    ["ziel betrieb gmbh", "ziel betrieb gmbh – terrassendächer", true],
    ["ziel-betrieb gmbh", "ziel betrieb gmbh", true],
    ["terrassen ziel betrieb", "ziel betrieb gmbh", true],
    ["mitbewerber terrassen", "ziel betrieb gmbh", false],
    ["ziel gmbh", "ziel betrieb ag", false],
  ])("%s ~ %s = %s", (a, b, expected) => {
    expect(isSimilarName(a, b)).toBe(expected);
  });
});

describe("local pack matching by profile name", () => {
  const status = (rows: SerpRow[], id: TargetIdentity = identity()) => localPackStatus(m(S2.ags, 1, rows), id);

  it("matches the exact profile name, keeping the raw name and the method", () => {
    expect(status([named(1, "Mitbewerber A"), named(2, "  ziel betrieb gmbh –  TERRASSENDÄCHER ")])).toEqual({
      status: "matched",
      rank: 2,
      method: "profile_name_exact",
      rawTitle: "  ziel betrieb gmbh –  TERRASSENDÄCHER ",
      reason: null,
    });
  });

  it("does not match a similar but different name: unverified", () => {
    for (const title of ["Ziel Betrieb GmbH", "Ziel Betrieb GmbH – Terrassendächer Frankfurt", "Ziel Betrieb GmbH - Terrassendächer"]) {
      // Hyphen instead of en dash: a different name (no punctuation cleanup for matching), but similar → unverified.
      expect(status([named(1, title)])).toMatchObject({ status: "match_unverified", reason: "similar_name", rawTitle: title });
    }
  });

  it("marks the same name appearing more than once as unverified", () => {
    expect(status([named(1, PROFILE), named(3, PROFILE.toUpperCase())])).toMatchObject({ status: "match_unverified", reason: "duplicate_name" });
  });

  it("reports no name match in a shown pack as not found in the pack", () => {
    expect(status([named(1, "Mitbewerber A"), named(2, "Mitbewerber B")])).toMatchObject({ status: "not_found_in_pack", method: null });
  });

  it("is not measurable when pack items come without a name", () => {
    expect(status([named(1, "Mitbewerber A"), named(2, null)])).toMatchObject({ status: "not_measurable", reason: "items_without_name" });
    expect(status([named(1, "   ")]).status).toBe("not_measurable");
  });

  it("distinguishes no local pack at all", () => {
    expect(status(organic("lokal-a.example")).status).toBe("no_local_pack");
  });

  it("is unverified without a verified profile name or cid", () => {
    expect(status([named(1, PROFILE)], identity({ profileNames: [] }))).toMatchObject({ status: "match_unverified", reason: "no_verified_identity" });
  });

  it("is unverified when the target domain shows up under another name", () => {
    expect(status([named(1, "Anderer Name", TARGET)])).toMatchObject({ status: "match_unverified", reason: "target_domain_without_identity" });
  });

  it("still matches a verified cid when the provider returns one", () => {
    expect(status([named(4, "Irgendwas", null, TARGET_CID)], identity({ cids: [TARGET_CID] }))).toMatchObject({ status: "matched", method: "cid", rank: 4 });
  });

  it("never matches by similarity, word removal or punctuation cleanup", () => {
    expect(status([named(1, "Ziel Betrieb Terrassendächer")]).status).not.toBe("matched");
    expect(status([named(1, "Ziel Betrieb GmbH Terrassendächer")]).status).not.toBe("matched");
  });
});

describe("local pack in the status table", () => {
  it("shows the method and keeps raw names per measurement", () => {
    const e = evaluate(scan([S2], [m(S2.ags, 1, [named(2, PROFILE)]), m(S2.ags, 2, [named(1, "Mitbewerber A")])], { targetProfileNames: [PROFILE] }), labels);
    expect(e.statusTable[0].localPack).toBe("im Local Pack, Platz 2 (Abgleich über den Profilnamen)");
    expect(e.statusTable[0].localPackDetails).toEqual([
      expect.objectContaining({ taskKey: `${S2.ags}-k1-s1`, status: "matched", method: "profile_name_exact", rawTitle: PROFILE }),
      expect.objectContaining({ taskKey: `${S2.ags}-k1-s2`, status: "not_found_in_pack" }),
    ]);
  });

  it.each([
    [[named(1, "Mitbewerber A")], "im angezeigten Local Pack kein Eintrag mit dem Profilnamen gefunden"],
    [[named(1, null)], "Local Pack nicht auswertbar"],
    [[named(1, "Ziel Betrieb GmbH")], "Betriebszuordnung nicht verifiziert"],
    [organic("x.example"), "kein Local Pack angezeigt"],
  ])("cell text for %#", (rows, text) => {
    const e = evaluate(scan([S2], [m(S2.ags, 1, rows as SerpRow[])], { targetProfileNames: [PROFILE] }), labels);
    expect(e.statusTable[0].localPack).toBe(text);
  });
});

describe("local_pack_gap", () => {
  const notFound = () => [1, 2, 3].map((s) => m(S2.ags, s, [named(1, "lokal-a", "lokal-a.example"), ...organic("x.example")]));

  it("is off in the pilot: no finding even when every measurement lacks the name", () => {
    const e = evaluate(scan([S2], notFound(), { targetProfileNames: [PROFILE] }), labels);
    expect(byRule(e, "local_pack_gap")).toEqual([]);
    expect(e.actions.some((a) => a.bucket === "google_profile")).toBe(false);
    expect(byRule(e, "review_priority")).toEqual([]); // no gap → no priority
  });

  it("when enabled later, it fires only on not-found measurements with a local competitor", () => {
    const e = evaluate(scan([S2], notFound(), { targetProfileNames: [PROFILE] }), labels, { localPackGap: true });
    const [f] = byRule(e, "local_pack_gap");
    expect(f.text).toContain("in keiner der 3 gültigen Messungen im Local Pack");
    expect(f.limits[0]).toContain("Relevanz, Entfernung und Bekanntheit");
    const unverified = [m(S2.ags, 1, [named(1, "Ziel Betrieb GmbH"), named(2, "lokal-a", "lokal-a.example")])];
    expect(byRule(evaluate(scan([S2], unverified, { targetProfileNames: [PROFILE] }), labels, { localPackGap: true }), "local_pack_gap")).toEqual([]);
  });
});

// ── competitor_coverage ─────────────────────────────────────────────────

describe("competitor_coverage", () => {
  it("uses measured settlements as denominator, shows planned, splits organic and local pack", () => {
    const ms = [
      m(S1.ags, 1, organic("lokal-a.example")),
      m(S2.ags, 1, [lp(1, "lokal-a.example", "2"), ...organic("x.example")]),
      m(S3.ags, 1, organic("y.example")),
      // S4 planned, never measured
    ];
    const e = evaluate(scan([S1, S2, S3, S4], ms), labels);
    const f = byRule(e, "competitor_coverage").find((x) => x.competitorDomain === "lokal-a.example")!;
    expect(f.text).toContain("Von 4 geplanten Gemeinden konnten 3 für „Terrassenüberdachung“ gemessen werden.");
    expect(f.text).toContain("lokal-a.example wurde in 2 dieser 3 Gemeinden in mindestens einer Messung");
    expect(f.text).toContain("(organisch: 1, Local Pack: 1)");
    expect(f.text).toContain("Eingeordnet von TechNS als: local.");
    expect(f.limits[0]).toContain("nicht, dass die Domain dort dauerhaft sichtbar ist");
    expect(f.score).toBe(67);
  });

  it("includes exactly 50 % and excludes below", () => {
    const ms = [m(S1.ags, 1, organic("lokal-a.example")), m(S2.ags, 1, organic("lokal-a.example")), m(S3.ags, 1, organic("q.example")), m(S4.ags, 1, organic("q.example"))];
    const e = evaluate(scan([S1, S2, S3, S4], ms), labels);
    expect(byRule(e, "competitor_coverage").map((f) => f.competitorDomain)).toEqual(expect.arrayContaining(["lokal-a.example", "q.example"]));
    const below = [m(S1.ags, 1, organic("lokal-a.example")), m(S2.ags, 1, organic("q.example")), m(S3.ags, 1, organic("q.example"))];
    expect(byRule(evaluate(scan([S1, S2, S3], below), labels), "competitor_coverage").some((f) => f.competitorDomain === "lokal-a.example")).toBe(false);
  });

  it("counts organic rank 11+ as not covered, excludes the target, marks unlabeled and portals", () => {
    const ms = [m(S1.ags, 1, organic(...Array(10).fill(0).map((_, i) => `z${i}.example`), "lokal-a.example", TARGET, "portal.example"))];
    const e = evaluate(scan([S1], ms), labels);
    const domains = byRule(e, "competitor_coverage").map((f) => f.competitorDomain);
    expect(domains).not.toContain("lokal-a.example");
    expect(domains).not.toContain(TARGET);
    const z = byRule(e, "competitor_coverage").find((f) => f.competitorDomain === "z0.example")!;
    expect(z.text).toContain("Nicht eingeordnet.");
    const portal = evaluate(scan([S1], [m(S1.ags, 1, organic("portal.example"))]), labels);
    const p = byRule(portal, "competitor_coverage").find((f) => f.competitorDomain === "portal.example")!;
    expect(p.evidence.details.listedSeparately).toBe(true);
    expect(p.text).toContain("Eingeordnet von TechNS als: portal.");
    expect(NON_COMPETITOR_LABELS).toContain("portal");
  });
});

// ── ad_observation ──────────────────────────────────────────────────────

describe("ad_observation", () => {
  it("needs 3 distinct sessions and reports k of n", () => {
    const ms = [m(S2.ags, 1, [ad(1, "w.example")]), m(S2.ags, 2, organic("x.example")), m(S2.ags, 3, [ad(1, "w.example")])];
    const [f] = byRule(evaluate(scan([S2], ms), labels), "ad_observation");
    expect(f.text).toBe("In Offenbach am Main wurden bei „Terrassenüberdachung“ in 2 von 3 Messungen aus 3 verschiedenen Sitzungen Anzeigen gesehen (21.10.2026, 22.10.2026 und 23.10.2026, mobil, Gemeindemitte).");
    expect(f.evidenceLevel).toBe("observation");
  });

  it("does not count two measurements of the same session twice", () => {
    const ms = [m(S2.ags, 1, [ad(1, "w.example")]), m(S2.ags, 1, [ad(1, "w.example")], { taskKey: "dup" }), m(S2.ags, 2, organic("x.example"))];
    expect(byRule(evaluate(scan([S2], ms), labels), "ad_observation")).toEqual([]);
  });

  it("ignores technical validation runs", () => {
    const ms = [1, 2, 3].map((s) => m(S2.ags, s, [ad(1, "w.example")], { samplingMode: "technical_validation" }));
    expect(byRule(evaluate(scan([S2], ms), labels), "ad_observation")).toEqual([]);
  });

  it("with no ads and an organic gap, adds a hypothesis and a verification action; never claims no competition", () => {
    const rows = organic("lokal-a.example", "lokal-b.example");
    const ms = [1, 2, 3].map((s) => m(S2.ags, s, rows));
    const e = evaluate(scan([S2], ms), labels);
    const ads = byRule(e, "ad_observation");
    expect(ads.map((f) => f.evidenceLevel)).toEqual(["observation", "hypothesis"]);
    expect(ads[0].text).toContain("in keiner der 3 Messungen aus 3 verschiedenen Sitzungen Anzeigen gesehen");
    expect(ads[1].text).toMatch(/^Hypothese, zu prüfen:/);
    expect(e.actions.find((a) => a.findingId === ads[1].id)).toMatchObject({ type: "verification", bucket: "ads" });
  });

  it("with no ads but no organic gap, adds no hypothesis", () => {
    const ms = [1, 2, 3].map((s) => m(S2.ags, s, organic(TARGET)));
    expect(byRule(evaluate(scan([S2], ms), labels), "ad_observation").map((f) => f.evidenceLevel)).toEqual(["observation"]);
  });
});

// ── review_priority ─────────────────────────────────────────────────────

describe("priorityScore", () => {
  it("follows the formula exactly", () => {
    const r = priorityScore({ organicGap: true, localPackGap: false, population: 50, maxPopulation: 100, distanceKm: 15, radiusKm: 30 });
    // 100 × (0.5 × 0.6 + 0.3 × 0.5 + 0.2 × 0.5) = 55
    expect(r).toEqual({ score: 55, gap: 0.6, population: 0.5, proximity: 0.5 });
    expect(priorityScore({ organicGap: true, localPackGap: true, population: 100, maxPopulation: 100, distanceKm: 0, radiusKm: 30 }).score).toBe(100);
  });

  it("keeps components within 0–1", () => {
    const r = priorityScore({ organicGap: true, localPackGap: true, population: 500, maxPopulation: 100, distanceKm: 45, radiusKm: 30 });
    expect(r).toMatchObject({ gap: 1, population: 1, proximity: 0 });
  });

  it("produces no score for a missing population, and rejects a zero radius", () => {
    expect(priorityScore({ organicGap: true, localPackGap: false, population: null, maxPopulation: 100, distanceKm: 1, radiusKm: 30 })).toEqual({ score: null, reason: "missing_population" });
    expect(() => priorityScore({ organicGap: true, localPackGap: false, population: 1, maxPopulation: 100, distanceKm: 1, radiusKm: 0 })).toThrow(/radiusKm/);
  });
});

describe("review_priority", () => {
  const gapRows = organic("lokal-a.example", "lokal-b.example");

  it("ranks gap settlements as an inference, explains the method, and gives gap findings the score", () => {
    const e = evaluate(scan([S1, S2], [m(S1.ags, 1, gapRows), m(S2.ags, 1, gapRows)]), labels);
    const p = byRule(e, "review_priority");
    expect(p.map((f) => [f.settlement, f.evidenceLevel])).toEqual([["Frankfurt am Main", "inference"], ["Offenbach am Main", "inference"]]);
    expect(p[0].text).toMatch(/^1\. Frankfurt am Main – Wert 80 \(Lücke 0,60, Einwohneranteil 1,00, Nähe 1,00\)$/);
    expect(e.priorityIntro).toContain("keine Bewertung des Geschäftspotenzials");
    expect(e.priorityIntro).toContain("Einwohnerzahl ist kein Suchvolumen, Nähe ist keine Rentabilität");
    expect(byRule(e, "organic_gap").find((f) => f.ags === S1.ags)?.score).toBe(80);
  });

  it("puts settlements without population into manual review", () => {
    const noPop = settlement("06438010", "Obertshausen", null, 12);
    const e = evaluate(scan([S1, noPop], [m(S1.ags, 1, gapRows), m(noPop.ags, 1, gapRows)]), labels);
    expect(byRule(e, "review_priority").map((f) => f.ags)).toEqual([S1.ags]);
    expect(e.manualReview).toEqual(["Obertshausen: Einwohnerzahl fehlt in den Daten, daher kein Wert – bitte manuell einordnen."]);
  });

  it("proposes at most 5 review actions", () => {
    const many = Array.from({ length: 7 }, (_, i) => settlement(`0641200${i}`, `Ort ${i}`, 1000 * (i + 1), i));
    const e = evaluate(scan(many, many.map((s) => m(s.ags, 1, gapRows))), labels);
    expect(byRule(e, "review_priority")).toHaveLength(7);
    expect(e.actions.filter((a) => a.findingId.startsWith("review_priority"))).toHaveLength(5);
  });
});

// ── wording ─────────────────────────────────────────────────────────────

describe("report wording", () => {
  const strings = (o: unknown): string[] => (typeof o === "string" ? [o] : typeof o === "object" && o ? Object.values(o).flatMap(strings) : []);

  it.each([
    /nicht sichtbar/i,
    /unsichtbar/i,
    /Sie fehlen/i,
    /fehlt (im|bei|in Google)/i,
    /kein(en)? (Anzeigen)?wettbewerb/i,
    /Ranking steigt/i,
    /garantiert/i,
    /werden Sie .* gefunden/i,
    /Umsatz/i,
  ])("no template contains %s", (pattern) => {
    for (const s of strings(reportText)) expect(s).not.toMatch(pattern);
  });

  it("'not found' always names the scanned depth", () => {
    expect(fill(reportText.status.notFound, { depth: 20 })).toBe("unter den ersten 20 organischen Ergebnissen nicht gefunden");
  });

  it("refuses to render a template with a missing placeholder", () => {
    expect(() => fill(reportText.organicGap.action, { keyword: "x" })).toThrow(/settlement/);
  });
});

// ── review fixes (f787001 review) ───────────────────────────────────────

describe("without a target domain", () => {
  const gapRows = organic("lokal-a.example", "lokal-b.example");

  it("says the target is not defined and produces no target-based organic findings", () => {
    const ms = [1, 2, 3].map((s) => m(S2.ags, s, gapRows));
    const e = evaluate(scan([S2], ms, { targetDomains: [] }), labels);
    expect(e.statusTable[0].organic).toBe("Ziel-Domain nicht festgelegt");
    expect(byRule(e, "organic_gap")).toEqual([]);
    expect(byRule(e, "review_priority")).toEqual([]);
    // General observations continue; no hypothesis without an organic gap.
    expect(byRule(e, "ad_observation").map((f) => f.evidenceLevel)).toEqual(["observation"]);
    expect(byRule(e, "competitor_coverage").map((f) => f.competitorDomain)).toContain("lokal-a.example");
  });
});

describe("keyword isolation", () => {
  const KW2 = "Terrassendach";
  it("an organic gap in one keyword does not create an ad hypothesis for another", () => {
    const gapRows = organic("lokal-a.example", "lokal-b.example");
    const kw1 = [1, 2, 3].map((s) => m(S2.ags, s, [ad(1, "w.example"), ...gapRows]));
    const kw2 = [1, 2, 3].map((s) => m(S2.ags, s, organic(TARGET), { keyword: KW2, taskKey: `${S2.ags}-k2-s${s}` }));
    const planned = [1, 2, 3].flatMap((session) => [
      { taskKey: `${S2.ags}-k1-s${session}`, ags: S2.ags, keyword: KW, session },
      { taskKey: `${S2.ags}-k2-s${session}`, ags: S2.ags, keyword: KW2, session },
    ]);
    const e = evaluate(
      scan([S2], [...kw1, ...kw2], { keywords: [{ term: KW, type: "main", samples: 3 }, { term: KW2, type: "main", samples: 3 }], plannedTasks: planned }),
      labels,
    );
    expect(byRule(e, "organic_gap").map((f) => f.keyword)).toEqual([KW]);
    // KW: ads seen → no hypothesis. KW2: no ads, but no organic gap for KW2 → no hypothesis either.
    expect(byRule(e, "ad_observation").filter((f) => f.evidenceLevel === "hypothesis")).toEqual([]);
  });

  it("a hypothesis links only to the organic gap of the same settlement and keyword", () => {
    const gapRows = organic("lokal-a.example", "lokal-b.example");
    const kw1 = [1, 2, 3].map((s) => m(S2.ags, s, gapRows));
    const kw2 = [1, 2, 3].map((s) => m(S2.ags, s, organic(TARGET), { keyword: KW2, taskKey: `${S2.ags}-k2-s${s}` }));
    const e = evaluate(scan([S2], [...kw1, ...kw2], { keywords: [{ term: KW, type: "main", samples: 3 }, { term: KW2, type: "main", samples: 3 }] }), labels);
    const hyp = byRule(e, "ad_observation").filter((f) => f.evidenceLevel === "hypothesis");
    expect(hyp.map((f) => f.keyword)).toEqual([KW]);
    const basedOn = hyp[0].evidence.details.basedOn as string[];
    for (const id of basedOn) expect(e.findings.map((f) => f.id)).toContain(id);
  });
});

describe("partial measurements in sentences", () => {
  it("names valid and planned measurements when some failed", () => {
    const gapRows = organic("lokal-a.example", "lokal-b.example");
    const ms = [m(S2.ags, 1, [lp(1, "lokal-a.example", "2"), ...gapRows]), m(S2.ags, 3, [lp(1, "lokal-a.example", "2"), ...gapRows])];
    const e = evaluate(scan([S2], ms, { targetProfileNames: ["Ziel Betrieb GmbH – Terrassendächer"] }), labels, { localPackGap: true });
    expect(byRule(e, "organic_gap")[0].text).toContain("in 2 gültigen von 3 geplanten Messungen nicht unter den ersten 10");
    expect(byRule(e, "local_pack_gap")[0].text).toContain("in keiner der 2 gültigen von 3 geplanten Messungen im Local Pack");
  });
});

describe("review_priority actions", () => {
  it("ask to check the findings of the settlement; the order is given by the numbers", () => {
    const e = evaluate(scan([S2], [m(S2.ags, 1, organic("lokal-a.example", "lokal-b.example"))]), labels);
    const id = byRule(e, "review_priority")[0].id;
    expect(e.actions.find((a) => a.findingId === id)?.text).toBe("Prüfen Sie die Befunde für Offenbach am Main.");
  });
});

// ── live response shape (first live trial, 21.10.2026) ──────────────────

describe("live local pack shape: cid null, Google as domain", () => {
  // Shaped like the live response: no cid, domain www.google.com, Google searchviewer URL.
  const liveItem = (rank: number, title: string) => ({
    type: "local_pack", rank_group: rank, rank_absolute: rank, title, domain: "www.google.com",
    url: "https://www.google.com/searchviewer/10?hl=de&gl=DE&svid=abc", cid: null, is_paid: false,
    rating: { rating_type: "Max5", value: 4.9, votes_count: 12, rating_max: 5 }, phone: null,
  });

  it("parses Google's own domain as no business domain", async () => {
    const { parseLiveResponse } = await import("@/lib/dataforseo/parse");
    const raw = { status_code: 20000, status_message: "Ok.", cost: 0.004, tasks: [{ id: "t", status_code: 20000, status_message: "Ok.", cost: 0.004, data: { depth: 20 }, result: [{ keyword: KW, check_url: null, datetime: null, items: [liveItem(1, "Betrieb A"), liveItem(2, "Betrieb B")] }] }] };
    const r = parseLiveResponse(raw);
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows.map((x) => [x.type, x.domain, x.cid, x.title])).toEqual([["local_pack", null, null, "Betrieb A"], ["local_pack", null, null, "Betrieb B"]]);
  });

  it("items without cid make the match unverified, never 'not matched'", () => {
    const rows = [lp(1, null, null), lp(2, null, null)];
    expect(localPackStatus(m(S2.ags, 1, rows), { domains: [TARGET], cids: [TARGET_CID], profileNames: [] }).status).toBe("match_unverified");
    const e = evaluate(scan([S2], [m(S2.ags, 1, [...rows, ...organic("lokal-a.example")])]), labels);
    expect(e.statusTable[0].localPack).toBe("Betriebszuordnung nicht verifiziert");
    expect(byRule(e, "local_pack_gap")).toEqual([]);
  });

  it("does not count Google as a competitor", () => {
    const e = evaluate(scan([S1], [m(S1.ags, 1, [lp(1, null, null), ...organic("lokal-a.example")])]), labels);
    expect(byRule(e, "competitor_coverage").some((f) => f.competitorDomain?.includes("google"))).toBe(false);
  });
});

describe("'not found' names the organic results actually returned", () => {
  it("uses the smallest organic list of the measurements, not the requested depth", () => {
    const fifteen = organic("lokal-a.example", "lokal-b.example").slice(0, 15);
    const e = evaluate(scan([S2], [m(S2.ags, 1, fifteen), m(S2.ags, 2, organic("lokal-a.example", "lokal-b.example"))]), labels);
    expect(e.statusTable[0].organic).toBe("unter den ersten 15 organischen Ergebnissen nicht gefunden");
    expect(byRule(e, "organic_gap")[0].text).toContain("(unter den ersten 15 organischen Ergebnissen nicht gefunden)");
  });

  it("says no organic results were shown when there are none", () => {
    const e = evaluate(scan([S2], [m(S2.ags, 1, [ad(1, "w.example")])]), labels);
    expect(e.statusTable[0].organic).toBe("keine organischen Ergebnisse angezeigt");
  });
});

// ── brand: other locations (brand with several locations) ─────────────────────────

describe("other locations of the brand in the Local Pack", () => {
  const HDH = "Beispielmiet Heidenheim";
  const id = (over: Partial<TargetIdentity> = {}): TargetIdentity => ({ domains: [TARGET], cids: [], profileNames: [HDH], brandNames: ["Beispielmiet"], ...over });
  const named = (rank: number, title: string): SerpRow => ({ ...lp(rank, null, null), title });

  it("matches only the verified profile name of the target location", () => {
    expect(localPackStatus(m(S2.ags, 1, [named(1, "Beispielmiet Ravensburg"), named(2, HDH)]), id())).toMatchObject({ status: "matched", rank: 2, rawTitle: HDH });
  });

  it("shows another location of the brand on its own, never as the target", () => {
    const r = localPackStatus(m(S2.ags, 1, [named(1, "Mitbewerber"), named(3, "Lift Beispielmiet Ravensburg")]), id());
    expect(r).toMatchObject({ status: "brand_other_location", rank: 3, rawTitle: "Lift Beispielmiet Ravensburg" });
    const e = evaluate(scan([S2], [m(S2.ags, 1, [named(3, "Lift Beispielmiet Ravensburg")])], { targetProfileNames: [HDH], brandNames: ["Beispielmiet"] }), labels);
    expect(e.statusTable[0].localPack).toBe("Eintrag der Marke im Local Pack (Platz 3: Lift Beispielmiet Ravensburg), nicht dem Zielstandort zugeordnet");
  });

  it("without a verified profile name, a brand entry is still not the target", () => {
    expect(localPackStatus(m(S2.ags, 1, [named(1, "Beispielmiet Service")]), id({ profileNames: [] })).status).toBe("brand_other_location");
  });

  it("needs the brand as a whole word", () => {
    expect(hasBrand("Beispielmiet-Service GmbH", "Beispielmiet")).toBe(true);
    expect(hasBrand("Schbeispielmiet Bau", "Beispielmiet")).toBe(false);
  });
});

describe("unapproved competitor labels (draft)", () => {
  it("marks coverage labels and organic gaps as provisional", () => {
    const ms = [1, 2, 3].map((s) => m(S2.ags, s, organic("lokal-a.example", "lokal-b.example")));
    const e = evaluate(scan([S2], ms), labels, { labelsApproved: false });
    expect(e.labelsApproved).toBe(false);
    const cov = byRule(e, "competitor_coverage").find((f) => f.competitorDomain === "lokal-a.example")!;
    expect(cov.text).toContain("Vorläufige Einordnung durch TechNS (nicht freigegeben): local.");
    expect(cov.text).not.toContain("Eingeordnet von TechNS als");
    expect(byRule(e, "organic_gap")[0].limits[0]).toContain("vorläufig und noch nicht freigegeben");
  });

  it("approved labels keep the normal wording", () => {
    const e = evaluate(scan([S2], [m(S2.ags, 1, organic("lokal-a.example"))]), labels);
    expect(e.labelsApproved).toBe(true);
    expect(byRule(e, "competitor_coverage").find((f) => f.competitorDomain === "lokal-a.example")!.text).toContain("Eingeordnet von TechNS als: local.");
  });
});

describe("ads cell in technical validation", () => {
  it("shows no ratio for back-to-back trials, only for session sampling", () => {
    const tech = [1, 2, 3].map((s) => m(S2.ags, s, [ad(1, "w.example")], { samplingMode: "technical_validation" }));
    expect(evaluate(scan([S2], tech), labels).statusTable[0].ads).toBe("nicht ausgewertet (technische Validierung)");
    const real = [1, 2, 3].map((s) => m(S2.ags, s, s === 2 ? organic("x.example") : [ad(1, "w.example")]));
    expect(evaluate(scan([S2], real), labels).statusTable[0].ads).toBe("2/3");
  });
});

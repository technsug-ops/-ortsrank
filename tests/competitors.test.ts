import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SerpRow } from "@/lib/dataforseo/parse";
import { addressMatchesMunicipality, CompetitorIndex, readRegistry, type Business, type CompetitorRegistry } from "@/lib/rules/competitors";
import { evaluate, type Labels } from "@/lib/rules/engine";
import type { Measurement, PlannedSettlement, ScanData } from "@/lib/rules/measurements";

// ── Builders (synthetic data only) ───────────────────────────────────────

const KW = "Arbeitsbühne mieten";
const TARGET = "ziel-betrieb.example";
const STADT: PlannedSettlement = { ags: "08000001", name: "Musterstadt an der Aue, Stadt", population: 40000, distanceKm: 0, lat: 48, lng: 10 };
const src = [{ url: "https://quelle.example/" }];
const address = (city: string) => ({ street: "Industriestraße", houseNumber: "5", postalCode: "73001", city });

function business(id: string, over: Partial<Business> = {}): Business {
  return {
    id,
    name: `Firma ${id}`,
    domains: [`${id}.example`],
    type: "rental",
    measuredService: { status: "verified", sources: src },
    locationsReviewed: { status: "complete", sources: src },
    locations: [{ ags: STADT.ags, kind: "branch", address: address("Musterstadt an der Aue"), serviceAtLocation: "not_verified", sources: src }],
    approved: false,
    ...over,
  };
}
const registry = (...businesses: Business[]): CompetitorRegistry => ({ measuredService: "Arbeitsbühnenvermietung", businesses });

const org = (rank: number, domain: string): SerpRow => ({ type: "organic", rank, rankAbsolute: rank, domain, url: `https://${domain}/`, title: domain });
/** Organic list: given domains at ranks 1.., padded with portal fillers to 20 (the fillers are in no registry). */
const organic = (...domains: string[]) => [...domains, ...Array.from({ length: 20 - domains.length }, (_, i) => `f-${i}.example`)].map((d, i) => org(i + 1, d));

function m(session: number, rows: SerpRow[]): Measurement {
  return { runId: "r", taskKey: `${STADT.ags}-k1-s${session}`, ags: STADT.ags, keyword: KW, sample: session, session, samplingMode: "sessions", rawPath: "r/raw/x.json", datetime: "2026-10-21 07:00:00 +00:00", device: "mobile", coordinate: "48,10,200", depth: 20, rows };
}
function scan(measurements: Measurement[]): ScanData {
  return {
    scanId: "s", runIds: ["r"], project: "p", radiusKm: 30, depth: 20, device: "mobile",
    targetDomains: [TARGET], targetCids: [], targetProfileNames: [], targetProfiles: [], identitySource: "test", brandNames: [],
    keywords: [{ term: KW, type: "main", samples: 3 }], settlements: [STADT],
    plannedTasks: measurements.map((x) => ({ taskKey: x.taskKey, ags: x.ags, keyword: KW, session: x.session })), measurements, failed: [],
  };
}
const gapCheck = (e: ReturnType<typeof evaluate>) => e.ruleChecks.find((c) => c.rule === "organic_gap")!;
/** Fillers are open (not in the registry); a registry entry per filler closes them. */
const fillers = Array.from({ length: 20 }, (_, i) => business(`f-${i}`, { domains: [`f-${i}.example`], locations: [] }));

// ── Municipality match ───────────────────────────────────────────────────

describe("address city against the official municipality name", () => {
  it.each([
    ["Ulm", "Ulm, Universitätsstadt", true],
    ["Neu-Ulm", "Ulm, Universitätsstadt", false],
    ["Babenhausen", "Babenhausen, M", true],
    ["Heidenheim", "Heidenheim an der Brenz, Stadt", false],
    ["Heidenheim an der Brenz", "Heidenheim an der Brenz, Stadt", true],
    ["Steinheim", "Steinheim am Albuch", false],
    ["Schwäbisch-Gmünd", "Schwäbisch Gmünd, Stadt", true],
  ])("%s ~ %s = %s", (city, official, expected) => {
    expect(addressMatchesMunicipality(city, official)).toBe(expected);
  });
});

// ── Assessment per business and municipality ─────────────────────────────

describe("verified local competitor", () => {
  const assess = (b: Business) => new CompetitorIndex(registry(b)).assess(`${b.id}.example`, STADT.ags, STADT.name);

  it("qualifies with an own branch matching the municipality and the verified service", () => {
    expect(assess(business("a"))).toMatchObject({ business: "a", status: "qualifies", reason: null });
    expect(assess(business("a", { locations: [{ ...business("a").locations[0], kind: "headquarters" }] })).status).toBe("qualifies");
  });

  it.each([
    ["legal address only", { locations: [{ ...business("a").locations[0], kind: "legal_only" as const }] }, "legal_address_only"],
    ["service not verified", { measuredService: { status: "not_verified" as const, sources: [] } }, "service_not_verified"],
    ["chain without the service verified at the location", { type: "rental_chain" as const }, "service_at_location_not_verified"],
    ["mixed business without the service verified at the location", { type: "mixed" as const }, "service_at_location_not_verified"],
    ["address city does not match the municipality", { locations: [{ ...business("a").locations[0], address: address("Neu-Musterstadt") }] }, "municipality_match_unclear"],
    ["location list not fully reviewed", { locations: [], locationsReviewed: { status: "partial" as const, sources: [] } }, "locations_not_fully_reviewed"],
    ["type unknown", { type: "unknown" as const }, "type_unknown"],
  ])("is unverified (never absent): %s", (_, over, reason) => {
    expect(assess(business("a", over))).toMatchObject({ status: "unverified", reason });
  });

  it("a chain qualifies when the service is verified at that location", () => {
    expect(assess(business("a", { type: "rental_chain", locations: [{ ...business("a").locations[0], serviceAtLocation: "verified" }] })).status).toBe("qualifies");
  });

  it("is not listed only after a complete review of the business's own locations", () => {
    expect(assess(business("a", { locations: [] }))).toMatchObject({ status: "not_listed", reason: "no_own_location_in_municipality" });
  });

  it("networks, portals and directories are excluded, not counted", () => {
    for (const type of ["network", "portal", "directory"] as const) expect(assess(business("a", { type })).status).toBe("excluded_type");
  });

  it("a domain outside the registry is unverified", () => {
    expect(new CompetitorIndex(registry()).assess("neu.example", STADT.ags, STADT.name)).toMatchObject({ business: "domain:neu.example", status: "unverified", reason: "not_in_registry" });
  });

  it("rejects a domain listed under two businesses", () => {
    const dir = mkdtempSync(join(tmpdir(), "ortsrank-reg-"));
    try {
      const file = join(dir, "r.json");
      writeFileSync(file, JSON.stringify(registry(business("a"), business("b", { domains: ["www.a.example"] }))));
      expect(() => readRegistry(file)).toThrow(/domain a\.example in a and b/);
      writeFileSync(file, JSON.stringify(registry(business("a"))));
      expect(readRegistry(file).businesses).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── organic_gap with the registry ────────────────────────────────────────

describe("organic_gap with verified local competitors", () => {
  const run = (ms: Measurement[], reg: CompetitorRegistry) => evaluate(scan(ms), new Map(), { competitors: reg });
  const every = (...domains: string[]) => [1, 2, 3].map((s) => m(s, organic(...domains)));

  it("fires with 2 verified local businesses in every measurement, with the scope stated", () => {
    const e = run(every("a.example", "b.example"), registry(business("a"), business("b"), ...fillers));
    expect(gapCheck(e)).toMatchObject({ status: "finding" });
    const f = e.findings.find((x) => x.rule === "organic_gap")!;
    expect(f.text).toContain("mindestens 2 Wettbewerber mit verifiziertem eigenem Standort in Musterstadt an der Aue, Stadt und verifiziertem Angebot");
    expect(f.text).toContain("Firma a und Firma b");
    expect(f.limits[0]).toContain("Anbieter aus Nachbargemeinden");
    expect(f.limits).toContain("Die Einordnung der Wettbewerber als lokal oder regional ist vorläufig und noch nicht freigegeben; diese Beobachtung gilt nur unter diesem Vorbehalt.");
  });

  it("counts businesses, not domains: two sites of one business are one competitor", () => {
    const e = run(every("a.example", "a2.example"), registry(business("a", { domains: ["a.example", "a2.example"] }), ...fillers));
    expect(gapCheck(e)).toMatchObject({ status: "not_met", reason: "fewer_than_2_verified_local_competitors" });
  });

  it("is not evaluable when unverified competitors could still reach 2 in every measurement", () => {
    const chain = business("kette", { type: "rental_chain" }); // branch here, service at the branch not verified
    const e = run(every("a.example", "kette.example"), registry(business("a"), chain, ...fillers));
    expect(gapCheck(e)).toMatchObject({ status: "not_evaluable", reason: "unverified_competitors_could_change_result" });
  });

  it("is not met when one measurement cannot reach 2, even if others could", () => {
    const ms = [m(1, organic("a.example", "kette.example")), m(2, organic("a.example", "kette.example")), m(3, organic("a.example"))];
    const e = run(ms, registry(business("a"), business("kette", { type: "rental_chain" }), ...fillers));
    expect(gapCheck(e)).toMatchObject({ status: "not_met", reason: "fewer_than_2_verified_local_competitors" });
  });

  it("portals and businesses without a location here do not count and do not keep it open", () => {
    const e = run(every("a.example", "portal.example", "weg.example"), registry(business("a"), business("portal", { type: "portal" }), business("weg", { locations: [] }), ...fillers));
    expect(gapCheck(e)).toMatchObject({ status: "not_met" });
  });

  it("domains outside the registry keep it open", () => {
    const e = run(every("a.example"), registry(business("a"))); // fillers are not in the registry
    expect(gapCheck(e)).toMatchObject({ status: "not_evaluable" });
  });

  it("the target in the top 10 decides first", () => {
    const e = run(every("a.example", "b.example", TARGET), registry(business("a"), business("b"), ...fillers));
    expect(gapCheck(e)).toMatchObject({ status: "not_met", reason: "target_in_top_10" });
  });

  it("coverage shows the business type from the registry, marked as not approved", () => {
    const e = run(every("a.example", "b.example"), registry(business("a"), business("b", { type: "rental_chain" }), ...fillers));
    const cov = e.findings.find((f) => f.rule === "competitor_coverage" && f.competitorDomain === "b.example")!;
    expect(cov.text).toContain("Art des Anbieters (vorläufig, nicht freigegeben): Vermietkette.");
  });
});

// ── labels path: the "could change the result" rule ─────────────────────

describe("organic_gap with labels: open domains must be able to change the result", () => {
  const labels: Labels = new Map([["lokal-a.example", "local"]]);
  const close = (n: number) => new Map([...labels, ...Array.from({ length: 20 }, (_, i) => [`f-${i}.example`, "national"] as const).slice(0, n)]) as Labels;

  it("is not met when one measurement cannot reach 2 even with all unlabelled domains", () => {
    const ms = [m(1, organic("lokal-a.example", "offen.example")), m(2, organic("lokal-a.example"))];
    const e = evaluate(scan(ms), close(20));
    expect(gapCheck(e)).toMatchObject({ status: "not_met", reason: "fewer_than_2_local_competitors" });
  });

  it("is not evaluable when every measurement could reach 2", () => {
    const ms = [m(1, organic("lokal-a.example", "offen.example")), m(2, organic("lokal-a.example", "offen.example"))];
    expect(gapCheck(evaluate(scan(ms), close(20)))).toMatchObject({ status: "not_evaluable", reason: "unlabelled_competitors_in_top_10" });
  });
});

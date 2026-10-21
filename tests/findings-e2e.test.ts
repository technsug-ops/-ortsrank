/**
 * End to end: three live session runs through scan.ts (mocked DataForSEO),
 * then scripts/findings.ts. The synthetic "world" gives every settlement a
 * different situation. Set SHOW_FINDINGS=<file> to write the report sentences there.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findingsMain } from "@/lib/rules/findings-run";
import type { Evaluation } from "@/lib/rules/engine";
import { main as scanMain } from "@/lib/scan-run";
import { readSettlementFile } from "@/lib/settlements";
import { loadFixture } from "./fixtures/load";

const SETTLEMENTS = "tests/fixtures/settlements.sample.json";
const TARGET = "ziel-betrieb.example";
const TARGET_CID = "1000000000000000001";
const MAIN = "Terrassenüberdachung";

const FRANKFURT = "06412000";
const A = "99000001";
const B = "99000002";
const G = "99000007";
const H = "99000008";

type Item = Record<string, unknown>;
// Only the fields the mock changes.
interface RawResponse {
  tasks: {
    data: Record<string, unknown>;
    result: { keyword: string; datetime: string; items: Item[]; items_count: number; item_types: unknown[] }[] | null;
  }[];
}
const organicItems = (ags: string, domains: string[]): Item[] => {
  const all = [...domains];
  for (let i = all.length; i < 20; i++) all.push(`f-${ags}-${i + 1}.example`);
  return all.map((d, i) => ({ type: "organic", rank_group: i + 1, domain: d, url: `https://${d}/`, title: d }));
};
const pack = (...entries: [string | null, string][]): Item[] =>
  entries.map(([domain, cid], i) => ({ type: "local_pack", rank_group: i + 1, domain, url: domain ? `https://${domain}/` : null, title: domain ?? "Betrieb ohne Website", cid, is_paid: false, rating: null, phone: null }));
const ads = (...domains: string[]): Item[] => domains.map((d, i) => ({ type: "paid", rank_group: i + 1, position: "top", domain: d, url: `https://${d}/`, title: d }));

/** What Google "shows" per settlement and session for the main keyword. */
function world(ags: string, session: number): Item[] {
  const filler = (n: number) => Array.from({ length: n }, (_, i) => `x-${ags}-${i}.example`);
  switch (ags) {
    case FRANKFURT:
      return [...ads("werbung.example"), ...pack([TARGET, TARGET_CID], ["lokal-a.example", "2"]), ...organicItems(ags, ["lokal-a.example", "lokal-b.example", TARGET])];
    case A:
      return [...pack(["lokal-a.example", "2"], ["portal.example", "5"]), ...organicItems(ags, ["lokal-a.example", "lokal-b.example", ...filler(11), TARGET])];
    case B: {
      const comps = session === 1 ? ["lokal-a.example", "lokal-b.example"] : session === 2 ? ["lokal-a.example", "region-c.example"] : ["lokal-a.example", "portal.example"];
      return [...(session === 2 ? ads("werbung.example") : []), ...organicItems(ags, comps)];
    }
    case G:
      return [...pack([TARGET, "999"], ["lokal-a.example", "2"]), ...organicItems(ags, ["lokal-a.example", "lokal-b.example"])];
    case H:
      return organicItems(ags, ["lokal-a.example", "region-c.example"]);
    default:
      throw new Error(`no world for ${ags}`);
  }
}

let root: string;
let output = "";
let evaluation: Evaluation;
let session = 1;
const calls = new Map<string, number>();

function fetchMock(byCoord: Map<string, string>) {
  return (async (_url: string, init: RequestInit) => {
    const [sent] = JSON.parse(init.body as string);
    const [lat, lng] = sent.location_coordinate.split(",");
    const ags = byCoord.get(`${Number(lat)},${Number(lng)}`)!;
    const key = `${ags}|${sent.keyword}|${session}`;
    const n = (calls.get(key) ?? 0) + 1;
    calls.set(key, n);
    // Frankfurt, first session-1 run: the first attempt times out, the retry succeeds.
    if (ags === FRANKFURT && session === 1 && sent.keyword === MAIN && n === 1) {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    }
    if (ags === H && session === 2) {
      const err = structuredClone(loadFixture("error-task")) as RawResponse;
      err.tasks[0].data = { ...err.tasks[0].data, ...sent };
      return new Response(JSON.stringify(err), { status: 200 });
    }
    const raw = structuredClone(loadFixture("success-mixed")) as RawResponse;
    const items: Item[] = (sent.keyword === MAIN ? world(ags, session) : organicItems(ags, ["lokal-a.example", TARGET])).map((it, i) => ({ ...it, rank_absolute: i + 1 }));
    const result = raw.tasks[0].result![0];
    raw.tasks[0].data = { ...raw.tasks[0].data, ...sent };
    result.keyword = sent.keyword;
    result.datetime = `2026-10-21 ${["07", "11", "16"][session - 1]}:00:00 +00:00`;
    result.items = items;
    result.items_count = items.length;
    result.item_types = [...new Set(items.map((i) => i.type))];
    return new Response(JSON.stringify(raw), { status: 200 });
  }) as unknown as typeof fetch;
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "ortsrank-findings-"));
  const runs = join(root, "runs");
  const project = join(root, "project.json");
  writeFileSync(
    project,
    JSON.stringify({
      ...JSON.parse(readFileSync("projects/pilot-rhein-main.json", "utf8")),
      targetDomains: [TARGET],
      targetLocalBusinesses: [{ cid: TARGET_CID, name: "Ziel Betrieb GmbH" }],
    }),
  );
  const labels = join(root, "labels.json");
  writeFileSync(labels, JSON.stringify({ "lokal-a.example": "local", "www.lokal-b.example": "local", "region-c.example": "regional", "portal.example": "portal" }));

  const byCoord = new Map(readSettlementFile(SETTLEMENTS).settlements.filter((s) => s.lat !== null).map((s) => [`${s.lat},${s.lng}`, s.ags]));
  const env = { SCAN_MAX_USD: "2", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p" };
  const run = async (s: number, random: string) => {
    session = s;
    const code = await scanMain(
      ["--project", project, "--settlements", SETTLEMENTS, "--runs-dir", runs, "--scan-id", "test-scan", "--session", String(s), "--live"],
      env,
      { out: () => {}, fetch: fetchMock(byCoord), sleep: async () => {}, random: () => random, now: () => new Date(`2026-10-21T${["07", "11", "16"][s - 1]}:00:00Z`) },
    );
    expect(code).toBe(0);
  };
  await run(1, "aaaaa1");
  await run(2, "aaaaa2");
  await run(3, "aaaaa3");
  await run(1, "aaaaa4"); // session 1 again: the first successful run must win, no extra samples

  const lines: string[] = [];
  expect(await findingsMain(["--scan-id", "test-scan", "--runs-dir", runs, "--labels", labels], { out: (l) => lines.push(l) })).toBe(0);
  output = lines.join("\n");
  evaluation = JSON.parse(readFileSync(join(runs, "scans", "test-scan", "findings.json"), "utf8"));
  if (process.env.SHOW_FINDINGS) writeFileSync(process.env.SHOW_FINDINGS, `${output}\n`, "utf8");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const ids = () => evaluation.findings.map((f) => f.id);
const cellOf = (ags: string, keyword = MAIN) => evaluation.statusTable.find((c) => c.ags === ags && c.keyword === keyword)!;

describe("findings end to end (synthetic world)", () => {
  it("counts one measurement per session task: retries and repeated runs are not samples", () => {
    expect(cellOf(FRANKFURT)).toMatchObject({ plannedSamples: 3, validSamples: 3, failedSamples: 0, organic: "bestes Ergebnis Platz 3", localPack: "im Local Pack, Platz 1", ads: "3/3" });
  });

  it("keeps failed measurements apart", () => {
    expect(cellOf(H)).toMatchObject({ validSamples: 2, failedSamples: 1, organic: "unter den ersten 20 organischen Ergebnissen nicht gefunden" });
  });

  it("produces the expected findings", () => {
    expect(ids()).toEqual(
      expect.arrayContaining([
        `organic_gap:${A}:${MAIN}`,
        `local_pack_gap:${A}:${MAIN}`,
        `organic_gap:${G}:${MAIN}`,
        `organic_gap:${H}:${MAIN}`,
        `ad_observation:${A}:${MAIN}`,
        `ad_observation:hypothesis:${A}:${MAIN}`,
        `competitor_coverage:lokal-a.example:${MAIN}`,
        `competitor_coverage:lokal-b.example:${MAIN}`,
        `review_priority:${A}`,
      ]),
    );
    // B: competitors change between measurements, never 2 local/regional in session 3.
    expect(ids()).not.toContain(`organic_gap:${B}:${MAIN}`);
    // G: target domain in the pack with an unverified cid → no local pack gap.
    expect(ids()).not.toContain(`local_pack_gap:${G}:${MAIN}`);
    expect(cellOf(G).localPack).toBe("Betriebszuordnung nicht verifiziert");
    // B: no local pack shown at all.
    expect(cellOf(B).localPack).toBe("kein Local Pack angezeigt");
    // H: only 2 valid sessions → no ad finding.
    expect(ids()).not.toContain(`ad_observation:${H}:${MAIN}`);
    // Frankfurt: no gaps.
    expect(ids().filter((id) => id.includes(FRANKFURT))).toEqual([`ad_observation:${FRANKFURT}:${MAIN}`]);
    // Portal and regional competitors below 50 %.
    expect(ids()).not.toContain(`competitor_coverage:portal.example:${MAIN}`);
  });

  it("writes the expected sentences", () => {
    expect(output).toContain(
      "(Beobachtung) In Beispielstadt A war ziel-betrieb.example bei „Terrassenüberdachung“ in 3 von 3 gültigen Messungen nicht unter den ersten 10 organischen Ergebnissen (bestes Ergebnis Platz 14).",
    );
    expect(output).toContain("Von 5 geplanten Gemeinden konnten 5 für „Terrassenüberdachung“ gemessen werden. lokal-a.example wurde in 5 dieser 5 Gemeinden");
    expect(output).toContain("In Beispielstadt B wurden bei „Terrassenüberdachung“ in 1 von 3 Messungen aus 3 verschiedenen Sitzungen Anzeigen gesehen");
    expect(output).toContain("(Hypothese) Hypothese, zu prüfen: Eine kleine Testkampagne");
    expect(output).toContain("(Ableitung) 1. ");
  });

  it("every finding points to raw responses that exist", () => {
    for (const f of evaluation.findings) {
      expect(f.evidence.measurements.length).toBeGreaterThan(0);
      for (const m of f.evidence.measurements) {
        expect(() => readFileSync(join(root, "runs", m.rawPath))).not.toThrow();
        expect(m.coordinate).toMatch(/^\d+\.\d+,\d+\.\d+,200$/);
      }
    }
  });
});

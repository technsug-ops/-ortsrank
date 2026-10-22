import { describe, expect, it } from "vitest";
import { addressFromSnippet, compareAddress, decodeSvid, profileIdFromUrl, type PostalAddress } from "@/lib/dataforseo/local-identity";
import { parseLiveResponse, type SerpRow } from "@/lib/dataforseo/parse";
import { assessLocalPackItem, evaluate, localPackStatus, type TargetIdentity } from "@/lib/rules/engine";
import type { Measurement, ScanData, TargetProfile } from "@/lib/rules/measurements";

// ── Synthetic svid values, shaped like the live ones (no real profile ids) ──

const varint = (n: number) => {
  const out: number[] = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  return [...out, n];
};
const bytesField = (no: number, b: number[]) => [...varint((no << 3) | 2), ...varint(b.length), ...b];
const ascii = (s: string) => [...Buffer.from(s, "utf8")];
const b64 = (b: number[], url = false) => Buffer.from(b).toString(url ? "base64url" : "base64").replace(/=+$/, "");

function svidFor(googleId: string): string {
  const payload = b64(bytesField(1, ascii(googleId)));
  const entry = [...bytesField(1, ascii("pvq")), ...bytesField(2, ascii(payload))];
  return b64([0x08, 0x0c, ...bytesField(2, bytesField(2, entry)), 0x18, 0x0a], true);
}
/** Second layout seen live on 22.10.2026: outer.2 → .5 → { 1: id }. */
function svidLayoutB(googleId: string): string {
  return b64([0x08, 0x26, ...bytesField(2, bytesField(5, bytesField(1, ascii(googleId)))), 0x18, 0x0a], true);
}
const viewer = (svid: string) => `https://www.google.com/searchviewer/10?hl=de&gl=DE&output=search&svid=${svid}`;

// ── Builders ────────────────────────────────────────────────────────────

const BRAND = "Beispielmiet";
const TITLE = "Beispielmiet Mietservice Arbeitsbühnen";
const OFFICE: TargetProfile = {
  key: "Büro",
  label: "Büro",
  cid: "1000000000000000001",
  googleId: null,
  address: { street: "Mühlweg", houseNumber: "21", postalCode: "73001", city: "Musterdorf am Berg" },
  source: "Testdaten",
};
const BRANCH: TargetProfile = {
  key: "Filiale",
  label: "Filiale",
  cid: "1000000000000000002",
  googleId: null,
  address: { street: "Lindenallee", houseNumber: "25/7", postalCode: "73002", city: "Beispielstadt an der Aue" },
  source: "Testdaten",
};
const identity = (profiles: TargetProfile[] = [OFFICE, BRANCH], over: Partial<TargetIdentity> = {}): TargetIdentity => ({
  domains: ["beispielmiet.example"],
  cids: profiles.flatMap((p) => (p.cid ? [p.cid] : [])),
  profileNames: [],
  brandNames: [BRAND],
  profiles,
  ...over,
});

function entry(over: Partial<SerpRow> = {}): SerpRow {
  return { type: "local_pack", rank: 1, rankAbsolute: 1, domain: null, url: null, title: TITLE, rating: 5, votesCount: 1, phone: null, isPaid: false, cid: null, svid: null, googleId: null, profileIdStatus: "absent", description: null, ...over };
}
const withGoogleId = (googleId: string, over: Partial<SerpRow> = {}) => entry({ url: viewer(svidFor(googleId)), svid: svidFor(googleId), googleId, profileIdStatus: "decoded", ...over });

function m(taskKey: string, rows: SerpRow[], ags = "08135019"): Measurement {
  return { runId: "r", taskKey, ags, keyword: "Arbeitsbühne mieten", sample: 1, session: 1, samplingMode: "technical_validation", rawPath: `r/raw/${taskKey}/attempt-1.json`, datetime: null, device: "mobile", coordinate: "48.6,10.1,200", depth: 20, rows };
}

function scan(measurements: Measurement[], profiles: TargetProfile[] = [OFFICE, BRANCH]): ScanData {
  const ags = [...new Set(measurements.map((x) => x.ags))];
  return {
    scanId: "s", runIds: ["r"], project: "p", radiusKm: 60, depth: 20, device: "mobile",
    targetDomains: ["beispielmiet.example"], targetCids: profiles.flatMap((p) => (p.cid ? [p.cid] : [])), targetProfileNames: [], targetProfiles: profiles,
    identitySource: "test", brandNames: [BRAND],
    keywords: [{ term: "Arbeitsbühne mieten", type: "main", samples: 1 }],
    settlements: ags.map((a, i) => ({ ags: a, name: `Ort ${i + 1}`, population: 10000, distanceKm: i, lat: 48, lng: 10 })),
    plannedTasks: measurements.map((x) => ({ taskKey: x.taskKey, ags: x.ags, keyword: x.keyword, session: 1 })),
    measurements, failed: [],
  };
}

// ── svid ────────────────────────────────────────────────────────────────

describe("svid → Google id", () => {
  it("decodes the observed structure and keeps the source value", () => {
    const svid = svidFor("/g/11abc_def");
    expect(decodeSvid(svid)).toBe("/g/11abc_def");
    expect(profileIdFromUrl(viewer(svid))).toEqual({ svid, googleId: "/g/11abc_def", status: "decoded" });
  });

  it("decodes the second observed structure (id directly in field 5)", () => {
    const svid = svidLayoutB("/g/1x2y3z");
    expect(decodeSvid(svid)).toBe("/g/1x2y3z");
    expect(profileIdFromUrl(viewer(svid))).toEqual({ svid, googleId: "/g/1x2y3z", status: "decoded" });
  });

  it.each([
    ["layout B without an id", b64([0x08, 0x26, ...bytesField(2, bytesField(5, bytesField(1, ascii("hello")))), 0x18, 0x0a], true)],
    ["layout B truncated", svidLayoutB("/g/1x2y3z").slice(0, 14)],
    ["unknown field in place of 2 / 5", b64([0x08, 0x26, ...bytesField(2, bytesField(7, bytesField(1, ascii("/g/1x2y3z")))), 0x18, 0x0a], true)],
    ["not base64", "%%%"],
    ["random bytes", b64([1, 2, 3, 4, 5, 6], true)],
    ["truncated", svidFor("/g/11abc_def").slice(0, 20)],
    ["other marker than pvq", b64([0x08, 0x0c, ...bytesField(2, bytesField(2, [...bytesField(1, ascii("xyz")), ...bytesField(2, ascii(b64(bytesField(1, ascii("/g/1x")))))]))], true)],
    ["no /g/ id inside", b64([0x08, 0x0c, ...bytesField(2, bytesField(2, [...bytesField(1, ascii("pvq")), ...bytesField(2, ascii(b64(bytesField(1, ascii("hello")))))]))], true)],
  ])("gives no id for %s, never a guess", (_, svid) => {
    expect(decodeSvid(svid)).toBeNull();
    expect(profileIdFromUrl(viewer(svid)).status).toBe("undecodable");
  });

  it("is absent without svid", () => {
    expect(profileIdFromUrl("https://www.beispielmiet.example/")).toEqual({ svid: null, googleId: null, status: "absent" });
    expect(profileIdFromUrl(null).status).toBe("absent");
  });

  it("the parser keeps cid, svid, Google id and snippet apart", () => {
    const svid = svidFor("/g/11abc_def");
    const raw = {
      status_code: 20000, status_message: "Ok.", cost: 0.004,
      tasks: [{ id: "t", status_code: 20000, status_message: "Ok.", cost: 0.004, data: { depth: 20 }, result: [{ keyword: "k", check_url: null, datetime: null, items: [
        { type: "local_pack", rank_group: 1, rank_absolute: 1, title: TITLE, domain: "www.google.com", url: viewer(svid), cid: null, description: "Verleih · Mühlweg 21" },
        { type: "local_pack", rank_group: 2, rank_absolute: 2, title: TITLE, domain: "www.beispielmiet.example", url: "https://www.beispielmiet.example/", cid: "123" },
      ] }] }],
    };
    const r = parseLiveResponse(raw);
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows.map((x) => [x.cid, x.svid, x.googleId, x.profileIdStatus, x.domain, x.description])).toEqual([
      [null, svid, "/g/11abc_def", "decoded", null, "Verleih · Mühlweg 21"],
      ["123", null, null, "absent", "beispielmiet.example", null],
    ]);
  });
});

// ── addresses ───────────────────────────────────────────────────────────

describe("addresses", () => {
  const verified: PostalAddress = { street: "Lindenallee", houseNumber: "25/7", postalCode: "73002", city: "Beispielstadt an der Aue" };

  it("reads street and house number from the separated snippet form", () => {
    expect(addressFromSnippet("Baumaschinenvermietung · Gartenstraße 14 \nSchließt demnächst · 17:00 \n")).toEqual({ street: "Gartenstraße", houseNumber: "14", postalCode: null, city: null });
  });

  it("reads a full address", () => {
    expect(addressFromSnippet("Verleih · Lindenallee 25 / 7, 73002 Beispielstadt an der Aue")).toEqual({ street: "Lindenallee", houseNumber: "25 / 7", postalCode: "73002", city: "Beispielstadt an der Aue" });
    expect(compareAddress(addressFromSnippet("Lindenallee 25 / 7, 73002 Beispielstadt an der Aue"), verified).result).toBe("full");
  });

  it("does not read a city name without postal code, nor opening hours", () => {
    expect(addressFromSnippet("Keine Rezensionen \nAusrüstungsverleih · Nebenort \nGeöffnet · Schließt um 18:00 \n")).toBeNull();
  });

  it("never merges different house numbers", () => {
    expect(compareAddress({ street: "Lindenallee", houseNumber: "25", postalCode: "73002", city: "Beispielstadt an der Aue" }, verified)).toMatchObject({ result: "conflict", differing: ["houseNumber"] });
    expect(compareAddress({ ...verified, houseNumber: "25a" }, verified).result).toBe("conflict");
  });

  it("the same street and number in another city is a conflict, not a match", () => {
    expect(compareAddress({ street: "Lindenallee", houseNumber: "25/7", postalCode: "73099", city: "Fernstadt" }, verified)).toMatchObject({ result: "conflict", differing: ["postalCode", "city"] });
  });

  it("street and number alone are partial, never full", () => {
    expect(compareAddress({ street: "Lindenallee", houseNumber: "25/7", postalCode: null, city: null }, verified)).toMatchObject({ result: "partial", missing: ["postalCode", "city"] });
  });

  it("a category glued to the street is uncertain; so is a longer street name", () => {
    const glued = addressFromSnippet("· Ausrüstungsverleih Mühlweg 21 · Schließt demnächst · 17:00");
    expect(compareAddress(glued, OFFICE.address!)).toMatchObject({ result: "partial", uncertain: ["street"] });
    const longer = { street: "Alte Hauptstraße", houseNumber: "5", postalCode: "73001", city: "Musterdorf am Berg" };
    expect(compareAddress(longer, { ...longer, street: "Hauptstraße" })).toMatchObject({ result: "partial", uncertain: ["street"] });
  });

  it("missing address is insufficient", () => {
    expect(compareAddress(null, verified)).toMatchObject({ result: "insufficient", missing: ["street", "houseNumber", "postalCode", "city"] });
  });
});

// ── assessments ─────────────────────────────────────────────────────────

describe("Local Pack entries against verified profiles", () => {
  it("same name, rating and review count at two branches: never merged, never matched (office vs. another branch)", () => {
    const office = withGoogleId("/g/11office", { description: "· Ausrüstungsverleih Mühlweg 21 · Schließt demnächst · 17:00" });
    const other = entry({ cid: "9000000000000000009", domain: "beispielmiet.example", description: "Keine Rezensionen \nAusrüstungsverleih · Nebenort \n" });
    expect([office.title, office.rating, office.votesCount]).toEqual([other.title, other.rating, other.votesCount]);
    const a = assessLocalPackItem(office, identity());
    const b = assessLocalPackItem(other, identity());
    expect(a).toMatchObject({ assessment: "brand_only", reason: "partial_address", profile: null, method: null });
    expect(b).toMatchObject({ assessment: "brand_only", reason: "cid_not_verified", profile: null, method: null });
    const e = evaluate(scan([m("t1", [office]), m("t2", [other])]), new Map());
    expect(e.localPackProfiles.map((p) => p.key).sort()).toEqual(["cid:9000000000000000009", "gid:/g/11office"]);
    expect(e.targetProfiles.every((p) => p.identityMatches.length === 0 && p.addressMatches.length === 0)).toBe(true);
  });

  it("the same street and number in another city does not become a branch match", () => {
    const r = assessLocalPackItem(entry({ description: "Verleih · Mühlweg 21, 73099 Fernstadt" }), identity());
    expect(r.assessment).toBe("brand_only");
    expect(r.reason).toBe("address_differs");
    expect(r.addressChecks.find((c) => c.profile === "Büro")).toMatchObject({ result: "conflict" });
  });

  it("a verified full address with the brand is an address match, apart from an id match", () => {
    const r = assessLocalPackItem(entry({ description: "Verleih · Mühlweg 21, 73001 Musterdorf am Berg" }), identity([{ ...OFFICE, cid: null }]));
    expect(r).toMatchObject({ assessment: "address_match", method: "address_full", profile: "Büro", fields: ["street", "houseNumber", "postalCode", "city", "title:brand"] });
    const s = localPackStatus(m("t", [entry({ description: "Verleih · Mühlweg 21, 73001 Musterdorf am Berg" })]), identity([{ ...OFFICE, cid: null }]));
    expect(s.status).toBe("address_match");
  });

  it("a full address on an entry with another id than the verified one is a conflict", () => {
    const r = assessLocalPackItem(entry({ cid: "9000000000000000009", description: "Mühlweg 21, 73001 Musterdorf am Berg" }), identity());
    expect(r).toMatchObject({ assessment: "ambiguous", reason: "address_identity_conflict" });
  });

  it("a full address without the brand stays ambiguous (another business at the same address)", () => {
    const r = assessLocalPackItem(entry({ title: "Steuerbüro Muster", description: "Mühlweg 21, 73001 Musterdorf am Berg" }), identity([{ ...OFFICE, cid: null }]));
    expect(r).toMatchObject({ assessment: "ambiguous", reason: "address_without_brand" });
  });

  it("an id of one profile with the full address of another is a conflict", () => {
    const r = assessLocalPackItem(entry({ cid: OFFICE.cid, description: "Lindenallee 25/7, 73002 Beispielstadt an der Aue" }), identity());
    expect(r).toMatchObject({ assessment: "ambiguous", reason: "identity_address_conflict" });
  });

  it("several address candidates stay ambiguous", () => {
    const twin: TargetProfile = { ...BRANCH, key: "Zweite", cid: null, address: { ...OFFICE.address!, postalCode: "73099", city: "Fernstadt" } };
    const r = assessLocalPackItem(entry({ description: "Verleih · Mühlweg 21 · Geöffnet" }), identity([{ ...OFFICE, cid: null }, twin]));
    expect(r).toMatchObject({ assessment: "ambiguous", reason: "several_address_candidates" });
  });

  it("missing address: a brand entry without id is a brand observation", () => {
    expect(assessLocalPackItem(entry(), identity())).toMatchObject({ assessment: "brand_only", reason: "no_verified_identity", observedAddress: null });
  });

  it("same profile with cid in one response and Google id in another: linked only by a verified entry", () => {
    const byCid = entry({ cid: OFFICE.cid, domain: "beispielmiet.example" });
    const byGid = withGoogleId("/g/11office");
    // No evidence that the two ids are one profile: the Google id entry is not matched.
    expect(assessLocalPackItem(byGid, identity())).toMatchObject({ assessment: "brand_only", profile: null });
    // With both ids in one verified entry, both match the same profile, once per measurement.
    const linked = [{ ...OFFICE, googleId: "/g/11office" }, BRANCH];
    expect(assessLocalPackItem(byCid, identity(linked))).toMatchObject({ assessment: "identity_match", method: "cid", profile: "Büro" });
    expect(assessLocalPackItem(byGid, identity(linked))).toMatchObject({ assessment: "identity_match", method: "google_id", profile: "Büro" });
    const e = evaluate(scan([m("t1", [byCid]), m("t2", [byGid, { ...byGid, rank: 2 }])], linked), new Map());
    expect(e.targetProfiles.find((p) => p.profile === "Büro")!.identityMatches).toEqual(["t1", "t2"]);
    // The id keys stay apart in the entry list; counts are distinct measurements.
    expect(e.localPackProfiles.find((p) => p.key === "gid:/g/11office")!.measurements).toEqual(["t2"]);
  });

  it("a profile match never gives the entry a domain", () => {
    const linked = [{ ...OFFICE, googleId: "/g/11office" }];
    const byGid = withGoogleId("/g/11office");
    expect(assessLocalPackItem(byGid, identity(linked))).toMatchObject({ assessment: "identity_match", domain: null });
    // A competitor's id entry without website is not counted for its domain, even if its name matches a website entry elsewhere.
    const site = entry({ title: "Mitbewerber GmbH", cid: "7000000000000000007", domain: "mitbewerber.example" });
    const noSite = withGoogleId("/g/11mitbewerber", { title: "Mitbewerber GmbH" });
    const e = evaluate(scan([m("t1", [site], "08000001"), m("t2", [noSite], "08000002")], linked), new Map());
    const cov = e.findings.find((f) => f.competitorDomain === "mitbewerber.example")!;
    expect(cov.evidence.details).toMatchObject({ localPack: ["08000001"] });
  });

  it("an undecodable svid gives neither a match nor 'not found'", () => {
    const bad = entry({ title: "Unbekannt", url: viewer("%%%"), svid: "%%%", googleId: null, profileIdStatus: "undecodable" });
    const other = entry({ title: "Mitbewerber", cid: "7000000000000000007" });
    expect(assessLocalPackItem(bad, identity())).toMatchObject({ assessment: "not_target", profile: null });
    expect(localPackStatus(m("t", [other, bad]), identity())).toMatchObject({ status: "not_measurable", reason: "profile_id_undecodable" });
  });

  it("an undecodable svid with the brand stays a brand observation", () => {
    const bad = entry({ url: viewer("%%%"), svid: "%%%", profileIdStatus: "undecodable" });
    expect(assessLocalPackItem(bad, identity())).toMatchObject({ assessment: "brand_only", reason: "profile_id_undecodable" });
  });

  it("several identity candidates for one id stay ambiguous", () => {
    const dup = [OFFICE, { ...BRANCH, cid: OFFICE.cid }];
    expect(assessLocalPackItem(entry({ cid: OFFICE.cid }), identity(dup))).toMatchObject({ assessment: "ambiguous", reason: "several_profiles_share_id" });
  });

  it("the address method does not switch on local_pack_gap", () => {
    const rows = [entry({ title: "Lokal A", cid: "7000000000000000007", domain: "lokal-a.example" })];
    const e = evaluate(scan([m("t1", rows)], [{ ...OFFICE, cid: null }]), new Map([["lokal-a.example", "local"]]));
    expect(e.ruleChecks.filter((c) => c.rule === "local_pack_gap").map((c) => c.status)).toEqual(["disabled"]);
    expect(e.findings.some((f) => f.rule === "local_pack_gap")).toBe(false);
  });
});

// ── positive matches, from a raw response through parser and rules ───────

describe("positive matches end to end (raw response → parser → status table)", () => {
  const rawItem = (rank: number, over: Record<string, unknown>) => ({
    type: "local_pack", rank_group: rank, rank_absolute: rank, title: "Mitbewerber GmbH", domain: "www.google.com",
    url: viewer(svidFor(`/g/11other${rank}`)), cid: null, is_paid: false, rating: null, phone: null, description: null, ...over,
  });
  function measured(items: Record<string, unknown>[], taskKey = "t1"): Measurement {
    const raw = { status_code: 20000, status_message: "Ok.", cost: 0.004, tasks: [{ id: "t", status_code: 20000, status_message: "Ok.", cost: 0.004, data: { depth: 20 }, result: [{ keyword: "k", check_url: null, datetime: null, items }] }] };
    const r = parseLiveResponse(raw);
    if (!r.ok || r.issues.length) throw new Error("expected a clean parse");
    return m(taskKey, r.rows);
  }
  const cellOf = (e: ReturnType<typeof evaluate>) => e.statusTable[0];

  it("a verified cid matches its profile", () => {
    const ms = measured([rawItem(1, {}), rawItem(2, { title: "Anderer Name", cid: OFFICE.cid, domain: "www.beispielmiet.example", url: "https://www.beispielmiet.example/" })]);
    const e = evaluate(scan([ms]), new Map());
    expect(cellOf(e).localPack).toBe("im Local Pack, Platz 2: Büro (Abgleich über verifizierte Kennung)");
    expect(cellOf(e).localPackDetails[0]).toMatchObject({ status: "matched", method: "cid", profile: "Büro", rank: 2 });
    expect(e.targetProfiles.find((p) => p.profile === "Büro")).toMatchObject({ identityMatches: ["t1"], addressMatches: [], ambiguous: [] });
    expect(e.targetProfiles.find((p) => p.profile === "Filiale")).toMatchObject({ identityMatches: [], addressMatches: [] });
  });

  it("a Google id matches when a verified entry links it to the profile", () => {
    const linked = [{ ...BRANCH, googleId: "/g/11filiale" }, OFFICE];
    const ms = measured([rawItem(1, {}), rawItem(3, { title: TITLE, url: viewer(svidFor("/g/11filiale")) })]);
    const e = evaluate(scan([ms], linked), new Map());
    expect(cellOf(e).localPackDetails[0]).toMatchObject({ status: "matched", method: "google_id", profile: "Filiale", rank: 3 });
    expect(cellOf(e).localPack).toBe("im Local Pack, Platz 3: Filiale (Abgleich über verifizierte Kennung)");
    expect(e.targetProfiles.find((p) => p.profile === "Filiale")!.identityMatches).toEqual(["t1"]);
  });

  it("a verified full address with the brand gives an address match, shown apart from an id match", () => {
    const noIds = [{ ...BRANCH, cid: null }, { ...OFFICE, cid: null }];
    const ms = measured([rawItem(1, {}), rawItem(2, { title: TITLE, description: "Verleih · Lindenallee 25/7, 73002 Beispielstadt an der Aue" })]);
    const e = evaluate(scan([ms], noIds), new Map());
    expect(cellOf(e).localPackDetails[0]).toMatchObject({ status: "address_match", method: "address_full", profile: "Filiale", rank: 2 });
    expect(cellOf(e).localPack).toBe("im Local Pack, Platz 2: Eintrag mit der vollständigen verifizierten Adresse von Filiale (Adressabgleich, keine verifizierte Kennung)");
    expect(e.targetProfiles.find((p) => p.profile === "Filiale")).toMatchObject({ identityMatches: [], addressMatches: ["t1"] });
  });

  it("an id match outranks a brand-only entry in the same measurement", () => {
    const ms = measured([rawItem(1, { title: TITLE }), rawItem(2, { title: TITLE, cid: BRANCH.cid })]);
    const d = evaluate(scan([ms]), new Map()).statusTable[0].localPackDetails[0];
    expect(d).toMatchObject({ status: "matched", profile: "Filiale", rank: 2 });
    expect(d.items.map((i) => i.assessment)).toEqual(["brand_only", "identity_match"]);
  });
});

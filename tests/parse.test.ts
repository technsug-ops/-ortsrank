import { describe, expect, it } from "vitest";
import { checkUrlLocation, matchesDomain, normalizeDomain, parseLiveResponse, type ParseResult } from "@/lib/dataforseo/parse";
import { loadFixture } from "./fixtures/load";

type Ok = Extract<ParseResult, { ok: true }>;
type Failed = Extract<ParseResult, { ok: false }>;

function ok(result: ParseResult): Ok {
  if (!result.ok) throw new Error(`expected ok, got ${result.level}: ${result.statusMessage}`);
  return result;
}
function failed(result: ParseResult): Failed {
  if (result.ok) throw new Error("expected a failed parse");
  return result;
}

const TARGET = "ziel-betrieb.example";

describe("normalizeDomain", () => {
  it.each([
    ["www.Example.de", "example.de"],
    ["WWW.Grosshandel-Dach.example", "grosshandel-dach.example"],
    [" shop.example.de. ", "shop.example.de"],
    ["www2.example.de", "www2.example.de"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe("matchesDomain", () => {
  it("matches the domain itself and its subdomains, not look-alikes", () => {
    expect(matchesDomain("ziel-betrieb.example", "www.ziel-betrieb.example")).toBe(true);
    expect(matchesDomain("shop.ziel-betrieb.example", TARGET)).toBe(true);
    expect(matchesDomain("andere-ziel-betrieb.example", TARGET)).toBe(false);
    expect(matchesDomain(null, TARGET)).toBe(false);
  });
});

describe("parseLiveResponse: success-mixed", () => {
  const r = ok(parseLiveResponse(loadFixture("success-mixed"), { targetDomains: ["WWW.Ziel-Betrieb.example"] }));
  const ofType = (type: string) => r.rows.filter((row) => row.type === type);

  it("reads task metadata", () => {
    expect(r.taskId).toBe("10211007-0000-0066-0000-000000000001");
    expect(r.costUsd).toBe(0.004);
    expect(r.depth).toBe(20);
    expect(r.keyword).toBe("Terrassenüberdachung");
    expect(r.checkUrl).toMatch(/^https:\/\/www\.google\.de\/search/);
    expect(r.datetime).toBe("2026-10-21 07:00:12 +00:00");
  });

  it("separates organic, ad and local_pack rows", () => {
    expect(ofType("organic")).toHaveLength(18);
    expect(ofType("ad")).toHaveLength(3);
    expect(ofType("local_pack")).toHaveLength(3);
    expect(r.rows).toHaveLength(24);
    expect(r.issues).toEqual([]);
  });

  it("counts other item types without turning them into rows", () => {
    expect(r.otherTypeCounts).toEqual({ people_also_ask: 1 });
    expect(r.rows.some((row) => (row.type as string) === "people_also_ask")).toBe(false);
  });

  it("keeps rank (per type) and rankAbsolute (page)", () => {
    expect(ofType("organic").map((row) => row.rank)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    const fourth = ofType("organic")[3];
    expect(fourth.rank).toBe(4);
    expect(fourth.rankAbsolute).toBe(10); // after 2 ads, 3 local, 3 organic and people_also_ask
  });

  it("normalises domains (lower case, no www.)", () => {
    expect(ofType("organic")[0].domain).toBe("mitbewerber-alu.example");
    expect(ofType("organic")[3].domain).toBe("grosshandel-dach.example");
    expect(r.rows.every((row) => row.domain === null || row.domain === row.domain.toLowerCase())).toBe(true);
    expect(r.rows.some((row) => row.domain?.startsWith("www."))).toBe(false);
  });

  it("keeps ad position top/bottom", () => {
    expect(ofType("ad").map((row) => [row.rank, row.adPosition])).toEqual([
      [1, "top"],
      [2, "top"],
      [3, "bottom"],
    ]);
  });

  it("keeps local pack rating, votes, phone, cid; null domain when there is no website", () => {
    const [first, , third] = ofType("local_pack");
    expect(first).toMatchObject({ rank: 1, domain: TARGET, rating: 4.8, votesCount: 57, isPaid: false, cid: "1000000000000000001" });
    expect(third).toMatchObject({ rank: 3, domain: null, url: null, rating: null, votesCount: null, phone: "+49 69 0000003" });
  });

  it("reports the target with its best rank per type", () => {
    expect(r.targets).toEqual([
      { domain: TARGET, status: "found", organicRank: 7, adRank: null, localPackRank: 1 },
    ]);
  });
});

describe("parseLiveResponse: target not found", () => {
  it("marks an absent target as not found within the scanned depth", () => {
    const r = ok(parseLiveResponse(loadFixture("success-no-local-pack"), { targetDomains: [TARGET] }));
    expect(r.rows.filter((row) => row.type === "local_pack")).toEqual([]);
    expect(r.rows).toHaveLength(11);
    expect(r.depth).toBe(10);
    expect(r.targets).toEqual([
      { domain: TARGET, status: "not_found_within_depth", organicRank: null, adRank: null, localPackRank: null },
    ]);
  });

  it("deduplicates target domains after normalisation", () => {
    const r = ok(parseLiveResponse(loadFixture("success-no-local-pack"), { targetDomains: [TARGET, `www.${TARGET}`] }));
    expect(r.targets).toHaveLength(1);
  });

  it("returns no targets when none are configured", () => {
    expect(ok(parseLiveResponse(loadFixture("success-mixed"))).targets).toEqual([]);
  });
});

describe("parseLiveResponse: empty and failed responses", () => {
  it("handles empty items", () => {
    const r = ok(parseLiveResponse(loadFixture("success-empty-items"), { targetDomains: [TARGET] }));
    expect(r.rows).toEqual([]);
    expect(r.otherTypeCounts).toEqual({});
    expect(r.targets[0].status).toBe("not_found_within_depth");
  });

  it("reports a task-level error without rows or target verdicts", () => {
    const r = failed(parseLiveResponse(loadFixture("error-task"), { targetDomains: [TARGET] }));
    expect(r).toMatchObject({ level: "task", statusCode: 40501, taskId: "10211007-0000-0066-0000-000000000004", costUsd: 0 });
    expect(r.statusMessage).toMatch(/location_coordinate/);
    expect("targets" in r).toBe(false);
  });

  it("reports an envelope-level error", () => {
    const r = failed(parseLiveResponse(loadFixture("error-top-level")));
    expect(r).toMatchObject({ level: "envelope", statusCode: 40100, taskId: null, costUsd: 0 });
  });

  it.each([
    ["null", null],
    ["empty object", {}],
    ["string", "<html>Bad Gateway</html>"],
    ["wrong types", { status_code: "20000", status_message: "Ok.", tasks: [] }],
  ])("reports an unexpected shape (%s) as invalid", (_label, raw) => {
    expect(failed(parseLiveResponse(raw)).level).toBe("invalid");
  });

  it("reports a response with more than one task as invalid", () => {
    const raw = loadFixture("success-mixed") as { tasks: unknown[] };
    const twice = { ...raw, tasks: [raw.tasks[0], raw.tasks[0]] };
    expect(failed(parseLiveResponse(twice)).statusMessage).toMatch(/exactly 1 task/);
  });

  it("treats a missing cost as null, not 0", () => {
    const raw = structuredClone(loadFixture("success-empty-items")) as { tasks: { cost?: number }[] };
    delete raw.tasks[0].cost;
    expect(ok(parseLiveResponse(raw)).costUsd).toBeNull();
  });
});

describe("parseLiveResponse: item issues", () => {
  function withItems(items: unknown[]) {
    const raw = structuredClone(loadFixture("success-empty-items")) as {
      tasks: { result: { items: unknown[] }[] }[];
    };
    raw.tasks[0].result[0].items = items;
    return raw;
  }

  it("records invalid items as issues instead of dropping them silently", () => {
    const r = ok(
      parseLiveResponse(
        withItems([
          { type: "organic", rank_group: 1, rank_absolute: 1, domain: "a.example", url: "https://a.example/" },
          { type: "organic", rank_group: 2, rank_absolute: 2, domain: null, url: null },
          { type: "paid", rank_group: "x", rank_absolute: 3, domain: "b.example" },
        ]),
      ),
    );
    expect(r.rows).toHaveLength(1);
    expect(r.issues.map((i) => [i.index, i.type])).toEqual([
      [1, "organic"],
      [2, "paid"],
    ]);
  });

  it("derives the domain from the url when domain is missing", () => {
    const r = ok(
      parseLiveResponse(withItems([{ type: "organic", rank_group: 1, rank_absolute: 1, url: "https://www.C.example/x" }])),
    );
    expect(r.rows[0].domain).toBe("c.example");
  });

  it("does not let an unknown item type without ranks invalidate the response", () => {
    const r = ok(parseLiveResponse(withItems([{ type: "ai_overview" }])));
    expect(r.otherTypeCounts).toEqual({ ai_overview: 1 });
  });
});

describe("checkUrlLocation", () => {
  // Synthetic record in the shape seen in live check_urls (21.10.2026).
  const record = "role: 1\nproducer: 12\nlatlng {\n  latitude_e7: 481436778\n  longitude_e7: 102528134\n}\nradius: 10000\nprovenance: 6\n";
  const url = (uule: string) => `https://www.google.de/search?q=x&hl=de&gl=DE&uule=${encodeURIComponent(uule)}`;

  it("decodes the point and radius of the uule", () => {
    const uule = "a+" + Buffer.from(record).toString("base64");
    expect(checkUrlLocation(url(uule))).toEqual({ lat: 48.1436778, lng: 10.2528134, radius: 10000 });
  });

  it("returns null without a readable uule", () => {
    expect(checkUrlLocation(null)).toBeNull();
    expect(checkUrlLocation("not a url")).toBeNull();
    expect(checkUrlLocation("https://www.google.de/search?q=x")).toBeNull();
    expect(checkUrlLocation(url("w+CAIQICIGQmVybGlu"))).toBeNull();
  });
});

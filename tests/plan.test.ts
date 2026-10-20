import { describe, expect, it } from "vitest";
import {
  buildTasks,
  checkCap,
  estimateCost,
  parseProject,
  roundUsd,
  serpsForDepth,
  tasksForSession,
  type PlannedSettlement,
  type ProjectInput,
} from "@/lib/plan";

const baseProject: ProjectInput = {
  name: "pilot-rhein-main",
  centerAgs: "06412000",
  radiusKm: 30,
  populationMin: 10000,
  maxSettlements: 30,
  device: "mobile",
  depth: 20,
  pointRadiusMm: 200,
  keywords: [
    { term: "Terrassenüberdachung", type: "main", samples: 3 },
    { term: "Terrassenüberdachung mit Montage", type: "intent", samples: 1 },
  ],
  targetDomains: [],
  sessions: [
    { id: 1, plannedAt: "09:00" },
    { id: 2, plannedAt: "13:00" },
    { id: 3, plannedAt: "18:00" },
  ],
};

const settlements = (n: number): PlannedSettlement[] =>
  Array.from({ length: n }, (_, i) => ({
    ags: String(6412000 + i).padStart(8, "0"),
    name: `Gemeinde ${i + 1}`,
    lat: 50 + i / 100,
    lng: 8.6,
  }));

const withKeywords = (others: number): ProjectInput => ({
  ...baseProject,
  keywords: [
    { term: "Terrassenüberdachung", type: "main", samples: 3 },
    ...Array.from({ length: others }, (_, i) => ({
      term: `Variante ${i + 1}`,
      type: "variant" as const,
      samples: 1,
    })),
  ],
});

describe("parseProject", () => {
  it("accepts the example project", () => {
    expect(parseProject(baseProject).keywords).toHaveLength(2);
  });

  it("defaults samples to 1 and targetDomains to []", () => {
    const rest: ProjectInput = { ...baseProject };
    delete rest.targetDomains;
    const p = parseProject({ ...rest, keywords: [{ term: "Markise", type: "main" }] });
    expect(p.keywords[0].samples).toBe(1);
    expect(p.targetDomains).toEqual([]);
  });

  it.each([
    ["point radius below 199 mm", { pointRadiusMm: 198 }],
    ["point radius above 199999 mm", { pointRadiusMm: 200_000 }],
    ["depth above 200", { depth: 201 }],
    ["depth 0", { depth: 0 }],
    ["unknown device", { device: "tablet" }],
    ["non-8-digit AGS", { centerAgs: "6412000" }],
    ["bad session time", { sessions: [{ id: 1, plannedAt: "9:00" }, { id: 2, plannedAt: "13:00" }, { id: 3, plannedAt: "25:00" }] }],
    ["no keywords", { keywords: [] }],
    ["unknown keyword type", { keywords: [{ term: "x", type: "brand", samples: 1 }] }],
    ["duplicate keyword", { keywords: [{ term: "Markise", type: "main" }, { term: "markise", type: "variant" }] }],
  ])("rejects %s", (_label, override) => {
    expect(() => parseProject({ ...baseProject, ...override })).toThrow();
  });

  it("rejects samples without a matching session", () => {
    expect(() => parseProject({ ...baseProject, sessions: [{ id: 1, plannedAt: "09:00" }] })).toThrow(
      /sample 2 needs a session/,
    );
  });
});

describe("buildTasks", () => {
  const project = parseProject(baseProject);

  it("creates settlement × keyword × sample tasks", () => {
    expect(buildTasks(project, settlements(2))).toHaveLength(8);
    expect(buildTasks(parseProject(withKeywords(4)), settlements(30))).toHaveLength(210);
  });

  it("assigns sample n to session n, with its planned time", () => {
    const tasks = buildTasks(project, settlements(1));
    expect(tasks.map((t) => [t.keyword, t.sample, t.session, t.plannedAt])).toEqual([
      ["Terrassenüberdachung", 1, 1, "09:00"],
      ["Terrassenüberdachung", 2, 2, "13:00"],
      ["Terrassenüberdachung", 3, 3, "18:00"],
      ["Terrassenüberdachung mit Montage", 1, 1, "09:00"],
    ]);
  });

  it("puts all keywords into session 1 and only the main keyword into sessions 2 and 3", () => {
    const tasks = buildTasks(project, settlements(2));
    expect(tasksForSession(tasks, 1)).toHaveLength(4);
    expect(new Set(tasksForSession(tasks, 1).map((t) => t.keyword)).size).toBe(2);
    for (const session of [2, 3]) {
      const inSession = tasksForSession(tasks, session);
      expect(inSession).toHaveLength(2);
      expect(inSession.every((t) => t.keywordType === "main")).toBe(true);
    }
    expect(tasksForSession(tasks, 4)).toEqual([]);
  });

  it("produces unique, filesystem-safe task keys", () => {
    const tasks = buildTasks(parseProject(withKeywords(4)), settlements(30));
    const keys = tasks.map((t) => t.taskKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^\d{8}-k\d+-s\d+$/.test(k))).toBe(true);
  });

  it("returns no tasks for no settlements", () => {
    expect(buildTasks(project, [])).toEqual([]);
  });
});

describe("estimateCost", () => {
  it("rounds SERP pages up", () => {
    expect(serpsForDepth(10)).toBe(1);
    expect(serpsForDepth(15)).toBe(2);
    expect(serpsForDepth(20)).toBe(2);
    expect(serpsForDepth(21)).toBe(3);
  });

  // Figures from PHASE1_PLAN section 6.
  it.each([
    ["small live trial", 8, 0.0384, 0.096],
    ["single full scan", 210, 1.008, 2.52],
    ["variability (3 days)", 630, 3.024, 7.56],
  ])("%s: %i tasks → expected %f, worst case %f", (_label, tasks, expected, worst) => {
    const e = estimateCost(tasks, 20);
    expect(e.costPerAttemptUsd).toBe(0.004);
    expect(e.maxAttempts).toBe(3);
    expect(e.expectedUsd).toBe(expected);
    expect(e.worstCaseUsd).toBe(worst);
  });

  it("uses price, retries and retry rate overrides", () => {
    const e = estimateCost(10, 15, { pricePerSerpUsd: 0.0006, maxRetries: 0, expectedRetryRate: 0 });
    expect(e.costPerAttemptUsd).toBe(0.0012);
    expect(e.maxAttempts).toBe(1);
    expect(e.expectedUsd).toBe(0.012);
    expect(e.worstCaseUsd).toBe(0.012);
  });

  it("rejects invalid options", () => {
    expect(() => estimateCost(1, 20, { pricePerSerpUsd: 0 })).toThrow(/pricePerSerpUsd/);
    expect(() => estimateCost(1, 20, { maxRetries: -1 })).toThrow(/maxRetries/);
    expect(() => estimateCost(1, 20, { expectedRetryRate: -0.1 })).toThrow(/expectedRetryRate/);
  });

  it("roundUsd removes float noise", () => {
    // 630 tasks × 0.004 $ × 3 attempts is the variability worst case.
    expect(630 * 0.004 * 3).not.toBe(7.56);
    expect(roundUsd(630 * 0.004 * 3)).toBe(7.56);
  });
});

describe("checkCap", () => {
  const small = estimateCost(8, 20); // expected 0.0384, worst 0.096

  it("is ok when the worst case fits", () => {
    expect(checkCap(small, 0.2).status).toBe("ok");
    expect(checkCap(small, 0.096).status).toBe("ok");
  });

  it("treats a cap exactly equal to the worst case as ok (no float noise)", () => {
    const variability = estimateCost(630, 20);
    expect(checkCap(variability, 7.56).status).toBe("ok");
  });

  it("warns when only the worst case exceeds the cap", () => {
    expect(checkCap(small, 0.05).status).toBe("warn_worst_case");
    expect(checkCap(small, 0.0384).status).toBe("warn_worst_case");
  });

  it("rejects when the expected cost exceeds the cap", () => {
    expect(checkCap(small, 0.0383).status).toBe("rejected");
    expect(checkCap(estimateCost(210, 20), 1.0).status).toBe("rejected");
  });

  it("rejects a missing or non-positive cap", () => {
    expect(() => checkCap(small, 0)).toThrow(/SCAN_MAX_USD/);
    expect(() => checkCap(small, Number.NaN)).toThrow(/SCAN_MAX_USD/);
  });
});

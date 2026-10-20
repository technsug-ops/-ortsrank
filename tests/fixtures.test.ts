import { describe, expect, it } from "vitest";
import { POINT_RADIUS_MM_MAX, POINT_RADIUS_MM_MIN } from "@/lib/scan-defaults";
import { fixtureNames, loadFixture, type FixtureName } from "./fixtures/load";

// Loose shapes: these tests check the fixtures themselves, not the parser.
interface Item {
  type: string;
  rank_group: number;
  rank_absolute: number;
  domain?: string | null;
}
interface Task {
  status_code: number;
  cost: number;
  data: { location_coordinate: string; depth: number };
  result: { items_count: number; item_types: string[]; items: Item[] }[] | null;
}
interface Envelope {
  _fixture: { synthetic: boolean; source: string; scenario: string };
  status_code: number;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Task[] | null;
}

const load = (name: string) => loadFixture(name as FixtureName) as Envelope;
const items = (name: FixtureName) => load(name).tasks![0].result![0].items;

describe("DataForSEO fixtures", () => {
  const names = fixtureNames();

  it("has the five expected scenarios", () => {
    expect(names.sort()).toEqual(
      ["error-task", "error-top-level", "success-empty-items", "success-mixed", "success-no-local-pack"],
    );
  });

  describe.each(names)("%s", (name) => {
    const f = load(name);

    it("is marked synthetic with a documentation source", () => {
      expect(f._fixture.synthetic).toBe(true);
      expect(f._fixture.source).toMatch(/^https:\/\/docs\.dataforseo\.com\//);
      expect(f._fixture.scenario.length).toBeGreaterThan(0);
    });

    it("has a consistent envelope (task count, errors, total cost)", () => {
      const tasks = f.tasks ?? [];
      expect(f.tasks_count).toBe(tasks.length);
      expect(f.tasks_error).toBe(tasks.filter((t) => t.status_code !== 20000).length);
      const sum = tasks.reduce((acc, t) => acc + t.cost, 0);
      expect(f.cost).toBeCloseTo(sum, 9);
    });

    it("uses only fictional .example domains", () => {
      const domains = (f.tasks ?? [])
        .flatMap((t) => t.result ?? [])
        .flatMap((r) => r.items)
        .map((i) => i.domain)
        .filter((d): d is string => typeof d === "string");
      expect(domains.every((d) => d.toLowerCase().endsWith(".example"))).toBe(true);
    });

    it("has consistent results (items_count, item_types, rank_absolute 1..n)", () => {
      for (const t of f.tasks ?? []) {
        for (const r of t.result ?? []) {
          expect(r.items_count).toBe(r.items.length);
          expect(r.item_types).toEqual([...new Set(r.items.map((i) => i.type))]);
          expect(r.items.map((i) => i.rank_absolute)).toEqual(r.items.map((_, i) => i + 1));
        }
      }
    });
  });

  it("success fixtures send a valid point radius in mm", () => {
    for (const name of ["success-mixed", "success-no-local-pack", "success-empty-items"] as const) {
      const radius = Number(load(name).tasks![0].data.location_coordinate.split(",")[2]);
      expect(radius).toBeGreaterThanOrEqual(POINT_RADIUS_MM_MIN);
      expect(radius).toBeLessThanOrEqual(POINT_RADIUS_MM_MAX);
    }
  });

  it("success-mixed: rank_group counts each type separately", () => {
    const all = items("success-mixed");
    for (const type of ["organic", "paid", "local_pack"]) {
      const groups = all.filter((i) => i.type === type).map((i) => i.rank_group);
      expect(groups).toEqual(groups.map((_, i) => i + 1));
    }
    expect(all.filter((i) => i.type === "organic")).toHaveLength(18);
    expect(all.filter((i) => i.type === "paid")).toHaveLength(3);
    expect(all.filter((i) => i.type === "local_pack")).toHaveLength(3);
    expect(all.some((i) => i.type === "people_also_ask")).toBe(true);
  });

  it("success-no-local-pack has no local_pack and no target domain", () => {
    const all = items("success-no-local-pack");
    expect(all.some((i) => i.type === "local_pack")).toBe(false);
    expect(all.some((i) => i.domain?.includes("ziel-betrieb"))).toBe(false);
  });

  it("error fixtures carry no results and no cost", () => {
    const taskError = load("error-task");
    expect(taskError.status_code).toBe(20000);
    expect(taskError.tasks![0].status_code).not.toBe(20000);
    expect(taskError.tasks![0].result).toBeNull();
    expect(taskError.cost).toBe(0);

    const topError = load("error-top-level");
    expect(topError.status_code).not.toBe(20000);
    expect(topError.tasks).toBeNull();
    expect(topError.cost).toBe(0);
  });
});

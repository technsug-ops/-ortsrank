import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { serpResults, settlements } from "@/db/schema";
import { settlementSchema } from "@/lib/settlements";

describe("schema nullability (PHASE1_PLAN 5.1, step 11)", () => {
  it("settlements keep missing Destatis values as null instead of inventing them", () => {
    const cols = getTableColumns(settlements);
    for (const c of [cols.lat, cols.lng, cols.population, cols.populationAsOf]) expect(c.notNull).toBe(false);
    for (const c of [cols.ags, cols.name, cols.state, cols.scanMode]) expect(c.notNull).toBe(true);
  });

  it("matches the settlement file schema for the nullable fields", () => {
    const row = {
      ags: "99000005", name: "x", state: "Hessen", district: null, lat: null, lng: null,
      population: null, populationAsOf: null, scanMode: "none", scanNote: "missing_coordinates,missing_population",
    };
    expect(settlementSchema.safeParse(row).success).toBe(true);
  });

  it("serp_results.domain accepts null for a local business without a website", () => {
    expect(getTableColumns(serpResults).domain.notNull).toBe(false);
  });
});

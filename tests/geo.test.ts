import { describe, expect, it } from "vitest";
import { haversineKm, selectSettlements, type SettlementGeo } from "@/lib/geo";

// City-centre coordinates (town halls), rounded to 6 decimals.
const FRANKFURT = { lat: 50.110644, lng: 8.682092 };
const OFFENBACH = { lat: 50.099557, lng: 8.76686 };
const BERLIN = { lat: 52.520008, lng: 13.404954 };
const MUNICH = { lat: 48.137154, lng: 11.576124 };

// Point `km` kilometres due north of FRANKFURT (1° latitude ≈ 111.195 km).
const northOf = (km: number) => ({ lat: FRANKFURT.lat + km / 111.19508, lng: FRANKFURT.lng });

function settlement(
  ags: string,
  location: { lat: number; lng: number } | null,
  population: number | null,
): SettlementGeo {
  return {
    ags,
    name: `Gemeinde ${ags}`,
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    population,
  };
}

describe("haversineKm", () => {
  it("Frankfurt – Offenbach is roughly 6–7 km", () => {
    const d = haversineKm(FRANKFURT, OFFENBACH);
    expect(d).toBeGreaterThan(6.0);
    expect(d).toBeLessThan(7.0);
  });

  it("Berlin – Munich is about 504 km", () => {
    expect(haversineKm(BERLIN, MUNICH)).toBeCloseTo(504, -1);
  });

  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(FRANKFURT, FRANKFURT)).toBe(0);
    expect(haversineKm(FRANKFURT, OFFENBACH)).toBeCloseTo(haversineKm(OFFENBACH, FRANKFURT), 9);
  });
});

describe("selectSettlements", () => {
  const center = settlement("06412000", FRANKFURT, 770_000);
  const near = settlement("06413000", OFFENBACH, 130_000);
  const atEdge = settlement("00000001", northOf(29.99), 20_000);
  const outside = settlement("00000002", northOf(30.01), 50_000);
  const small = settlement("00000003", northOf(10), 4_000);
  const noPopulation = settlement("00000004", northOf(12), null);
  const noCoordinates = settlement("00000005", null, 25_000);
  const nothing = settlement("00000006", null, null);
  const halfCoordinates: SettlementGeo = { ...settlement("00000007", null, 15_000), lat: 50.2 };

  const all = [outside, small, atEdge, noCoordinates, near, nothing, noPopulation, center, halfCoordinates];
  const options = { center: FRANKFURT, radiusKm: 30, populationMin: 10_000 };

  it("splits settlements into the four lists", () => {
    const r = selectSettlements(all, options);
    expect(r.selected.map((s) => s.ags)).toEqual(["06412000", "06413000", "00000001"]);
    expect(r.unknownPopulation.map((s) => s.ags)).toEqual(["00000004"]);
    expect(r.belowThreshold.map((s) => s.ags)).toEqual(["00000003"]);
    expect(r.unlocatable.map((s) => s.ags).sort()).toEqual(["00000005", "00000006", "00000007"]);
    expect(r.overLimit).toEqual([]);
  });

  it("includes the centre settlement first, at distance 0", () => {
    const r = selectSettlements(all, options);
    expect(r.selected[0].ags).toBe("06412000");
    expect(r.selected[0].distanceKm).toBe(0);
  });

  it("sorts selected by distance and attaches distanceKm", () => {
    const r = selectSettlements(all, options);
    const distances = r.selected.map((s) => s.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(r.selected[2].distanceKm).toBeCloseTo(29.99, 2);
  });

  it("treats the radius as an inclusive boundary", () => {
    const r = selectSettlements([settlement("x", northOf(30), 20_000)], { ...options, radiusKm: 30.0001 });
    expect(r.selected).toHaveLength(1);
    const outsideOnly = selectSettlements([outside], options);
    expect(outsideOnly.selected).toHaveLength(0);
    // Outside the radius means not part of the area at all, not "below threshold".
    expect(outsideOnly.belowThreshold).toHaveLength(0);
  });

  it("applies the population threshold inclusively", () => {
    const exactly = settlement("x", northOf(5), 10_000);
    const oneLess = settlement("y", northOf(5), 9_999);
    const r = selectSettlements([exactly, oneLess], options);
    expect(r.selected.map((s) => s.ags)).toEqual(["x"]);
    expect(r.belowThreshold.map((s) => s.ags)).toEqual(["y"]);
  });

  it("never puts a settlement without coordinates into selected, even with a large population", () => {
    const r = selectSettlements([noCoordinates, halfCoordinates], { ...options, populationMin: 0 });
    expect(r.selected).toHaveLength(0);
    expect(r.unknownPopulation).toHaveLength(0);
    expect(r.unlocatable).toHaveLength(2);
  });

  it("keeps the nearest settlements when limited and reports the rest as overLimit", () => {
    const r = selectSettlements(all, { ...options, limit: 2 });
    expect(r.selected.map((s) => s.ags)).toEqual(["06412000", "06413000"]);
    expect(r.overLimit.map((s) => s.ags)).toEqual(["00000001"]);
  });

  it("passes extra fields through unchanged", () => {
    const withState = { ...near, state: "Hessen" };
    const r = selectSettlements([withState], options);
    expect(r.selected[0].state).toBe("Hessen");
  });

  it("rejects invalid options", () => {
    expect(() => selectSettlements(all, { ...options, radiusKm: 0 })).toThrow(/radiusKm/);
    expect(() => selectSettlements(all, { ...options, populationMin: -1 })).toThrow(/populationMin/);
    expect(() => selectSettlements(all, { ...options, limit: 0 })).toThrow(/limit/);
    expect(() => selectSettlements(all, { ...options, limit: 1.5 })).toThrow(/limit/);
  });
});

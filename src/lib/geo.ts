/**
 * Geographic helpers for choosing which municipalities to scan.
 *
 * `radiusKm` here is the service area around the project centre. It is not
 * the DataForSEO `location_coordinate` radius, which is in millimetres and
 * describes the precision of a single measurement point.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Minimum fields needed for selection; extra fields are passed through. */
export interface SettlementGeo {
  ags: string;
  name: string;
  lat: number | null;
  lng: number | null;
  population: number | null;
}

export type WithDistance<T> = T & { distanceKm: number };

export interface SelectionOptions {
  center: LatLng;
  radiusKm: number;
  populationMin: number;
  /** Optional upper bound (inclusive); larger settlements go to `aboveMaximum`. */
  populationMax?: number;
  /** Maximum size of `selected`; the nearest ones are kept. */
  limit?: number;
}

export interface Selection<T extends SettlementGeo> {
  /** Located, inside the radius, population >= threshold; nearest first. */
  selected: WithDistance<T>[];
  /** Located, inside the radius, population unknown; nearest first. */
  unknownPopulation: WithDistance<T>[];
  /** No coordinates: cannot tell whether they are inside the radius. */
  unlocatable: T[];
  /** Located, inside the radius, population < threshold; nearest first. */
  belowThreshold: WithDistance<T>[];
  /** Located, inside the radius, population > populationMax; nearest first. */
  aboveMaximum: WithDistance<T>[];
  /** Settlements that qualified for `selected` but were cut by `limit`. */
  overLimit: WithDistance<T>[];
}

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Coordinates of a settlement, or null if either value is missing or invalid. */
export function locationOf(s: SettlementGeo): LatLng | null {
  if (s.lat === null || s.lng === null) return null;
  if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return null;
  return { lat: s.lat, lng: s.lng };
}

const byDistance = <T>(a: WithDistance<T>, b: WithDistance<T>) => a.distanceKm - b.distanceKm;

export function selectSettlements<T extends SettlementGeo>(
  settlements: readonly T[],
  options: SelectionOptions,
): Selection<T> {
  const { center, radiusKm, populationMin, populationMax, limit } = options;
  if (!(radiusKm > 0)) throw new Error(`radiusKm must be > 0, got ${radiusKm}`);
  if (!(populationMin >= 0)) throw new Error(`populationMin must be >= 0, got ${populationMin}`);
  if (populationMax !== undefined && !(populationMax >= populationMin)) {
    throw new Error(`populationMax must be >= populationMin, got ${populationMax}`);
  }
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 0)) {
    throw new Error(`limit must be a non-negative integer, got ${limit}`);
  }

  const qualified: WithDistance<T>[] = [];
  const unknownPopulation: WithDistance<T>[] = [];
  const unlocatable: T[] = [];
  const belowThreshold: WithDistance<T>[] = [];
  const aboveMaximum: WithDistance<T>[] = [];

  for (const s of settlements) {
    const location = locationOf(s);
    if (!location) {
      unlocatable.push(s);
      continue;
    }
    const distanceKm = haversineKm(center, location);
    if (distanceKm > radiusKm) continue;

    const entry = { ...s, distanceKm };
    if (s.population === null) unknownPopulation.push(entry);
    else if (populationMax !== undefined && s.population > populationMax) aboveMaximum.push(entry);
    else if (s.population >= populationMin) qualified.push(entry);
    else belowThreshold.push(entry);
  }

  qualified.sort(byDistance);
  unknownPopulation.sort(byDistance);
  belowThreshold.sort(byDistance);
  aboveMaximum.sort(byDistance);

  const cut = limit ?? qualified.length;
  return {
    selected: qualified.slice(0, cut),
    unknownPopulation,
    unlocatable,
    belowThreshold,
    aboveMaximum,
    overLimit: qualified.slice(cut),
  };
}

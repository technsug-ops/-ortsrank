/**
 * Destatis Gemeindeverzeichnis (GV-ISys) "Alle politisch selbständigen
 * Gemeinden" XLSX → settlement list (PHASE1_PLAN 5.1).
 *
 * Columns are found by header text, never by fixed position. The header
 * spans several rows (e.g. "Amtlicher Regionalschlüssel (ARS)" over
 * "Land | RB | Kreis | VB | Gem"); labels carry footnote digits such as
 * "Zensus 20222)". A missing required column stops the import.
 *
 * Verified against 31122025_Auszug_GV.xlsx (Gebietsstand 31.12.2025,
 * published August 2026), sheet "Onlineprodukt_Gemeinden31122025".
 */
import type { Settlement } from "@/lib/settlements";

export type Cell = string | number | null;

/** Satzart of a municipality row. */
export const SATZART_GEMEINDE = "60";
const SATZART_LAND = "10";
const SATZART_KREIS = "40";

/**
 * Textkennzeichen of unincorporated areas (gemeindefreie Gebiete):
 * 65 = inhabited (e.g. military training areas), 66 = uninhabited (forests,
 * lakes, coastal waters). They are not municipalities and are excluded,
 * but reported (ROADMAP 4: unit is the politically independent municipality).
 */
export const TEXTKENNZEICHEN_GEMEINDEFREI = new Set(["65", "66"]);

export interface ColumnMap {
  satzart: number;
  textkennzeichen: number;
  land: number;
  rb: number;
  kreis: number;
  gem: number;
  name: number;
  population: number;
  lng: number;
  lat: number;
}

const clean = (c: Cell) => (c === null ? "" : String(c).replace(/\s+/g, " ").trim());

/**
 * Header label without its footnote marker: one digit plus ")" glued to the
 * end ("Zensus 20222)" → "Zensus 2022", "Postleitzahl3)" → "Postleitzahl").
 * A closing parenthesis that belongs to an opening one is kept ("(Jahr)").
 */
export function headerLabel(c: Cell): string {
  const s = clean(c);
  const lastOpen = s.lastIndexOf("(");
  const balanced = lastOpen >= 0 && s.indexOf(")", lastOpen) === s.length - 1;
  return (balanced ? s : s.replace(/\d\)$/, "")).trim();
}
const label = headerLabel;

export interface HeaderInfo {
  columns: ColumnMap;
  /** Index of the first data row. */
  dataStart: number;
  /** Header text per column, rows joined with " / ", for the import report. */
  labels: string[];
  /** Reference date of the population column, as found in the header (e.g. "31.12.2025 (Jahr)"). */
  populationDateText: string | null;
}

/** Finds the header block starting at the row whose first cell is "Satzart". */
export function findHeader(rows: Cell[][]): HeaderInfo {
  const start = rows.findIndex((r) => label(r[0] ?? null) === "Satzart");
  if (start < 0) throw new Error('header row with "Satzart" not found');
  let end = start + 1;
  // Header rows continue until the first row whose Satzart cell is a number code.
  while (end < rows.length && !/^\d+$/.test(clean(rows[end][0] ?? null))) end++;
  const block = rows.slice(start, end);
  const width = Math.max(...block.map((r) => r.length));

  // Forward-fill the top row so a parent label covers its sub-columns.
  const parents: string[] = [];
  let current = "";
  for (let c = 0; c < width; c++) {
    const v = label(block[0][c] ?? null);
    if (v) current = v;
    parents.push(current);
  }
  const sub = (c: number) => block.slice(1).map((r) => label(r[c] ?? null));
  const labels = Array.from({ length: width }, (_, c) => [label(block[0][c] ?? null), ...sub(c)].filter(Boolean).join(" / "));

  const find = (name: string, test: (c: number) => boolean): number => {
    const hits = Array.from({ length: width }, (_, c) => c).filter(test);
    if (hits.length === 0) throw new Error(`required column "${name}" not found in header`);
    if (hits.length > 1) throw new Error(`column "${name}" is ambiguous (columns ${hits.map((h) => h + 1).join(", ")})`);
    return hits[0];
  };
  const ars = (part: string) => (c: number) => /^Amtlicher Regionalschlüssel/.test(parents[c]) && sub(c)[0] === part;

  const columns: ColumnMap = {
    satzart: find("Satzart", (c) => label(block[0][c] ?? null) === "Satzart"),
    textkennzeichen: find("Textkennzeichen", (c) => label(block[0][c] ?? null) === "Textkennzeichen"),
    land: find("ARS / Land", ars("Land")),
    rb: find("ARS / RB", ars("RB")),
    kreis: find("ARS / Kreis", ars("Kreis")),
    gem: find("ARS / Gem", ars("Gem")),
    name: find("Gemeindename", (c) => label(block[0][c] ?? null) === "Gemeindename"),
    population: find("Bevölkerung / insgesamt", (c) => /^Bevölkerung/.test(parents[c]) && sub(c)[0] === "insgesamt"),
    lng: find("Längengrad", (c) => sub(c)[0] === "Längengrad"),
    lat: find("Breitengrad", (c) => sub(c)[0] === "Breitengrad"),
  };
  const dateRow = block.slice(1).find((r) => /\d{2}\.\d{2}\.\d{4}/.test(clean(r[columns.population] ?? null)));
  return { columns, dataStart: end, labels, populationDateText: dateRow ? clean(dateRow[columns.population]) : null };
}

/** "31.12.2025 (Jahr)" → "2025-12-31". */
export function germanDateToIso(text: string | null): string | null {
  const m = text?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Integer in German notation ("1.234", "1 234", 1234). Empty → null; anything else throws. */
export function parseGermanInteger(value: Cell): number | null {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`expected an integer, got ${value}`);
    return value;
  }
  const s = value.trim();
  if (s === "" || s === "-" || s === "–" || s === ".") return null;
  if (!/^\d{1,3}([.\s]\d{3})*$|^\d+$/.test(s)) throw new Error(`not an integer in German notation: "${value}"`);
  return Number(s.replace(/[.\s]/g, ""));
}

/** Decimal in German notation ("8,6821"). Coordinates never carry thousands separators. */
export function parseGermanDecimal(value: Cell): number | null {
  if (value === null) return null;
  if (typeof value === "number") return value;
  const s = value.trim();
  if (s === "" || s === "-" || s === "–") return null;
  if (!/^-?\d+(,\d+)?$/.test(s)) throw new Error(`not a decimal in German notation: "${value}"`);
  return Number(s.replace(",", "."));
}

const digits = (value: Cell, length: number, what: string, row: number): string => {
  const s = clean(value);
  if (!/^\d+$/.test(s) || s.length > length) throw new Error(`row ${row}: ${what} "${s}" is not a ${length}-digit code`);
  return s.padStart(length, "0");
};

export interface ExcludedRow {
  ags: string;
  name: string;
  textkennzeichen: string;
}

export interface ImportSummary {
  municipalities: number;
  byState: Record<string, number>;
  missingCoordinates: number;
  missingPopulation: number;
  missingBoth: number;
  /** Unincorporated areas (Textkennzeichen 65/66), not counted as municipalities. */
  excludedGemeindefrei: ExcludedRow[];
}

export interface ParsedGv {
  settlements: Settlement[];
  summary: ImportSummary;
  header: HeaderInfo;
  populationAsOf: string | null;
}

export function parseGemeindeverzeichnis(rows: Cell[][], options: { asOf?: string | null } = {}): ParsedGv {
  const header = findHeader(rows);
  const col = header.columns;
  const populationAsOf = options.asOf ?? germanDateToIso(header.populationDateText);
  if (!populationAsOf) throw new Error("population reference date not found in header; pass --as-of YYYY-MM-DD");

  const states = new Map<string, string>();
  const districts = new Map<string, string>();
  const settlements: Settlement[] = [];
  const excluded: ExcludedRow[] = [];
  const seen = new Set<string>();

  for (let i = header.dataStart; i < rows.length; i++) {
    const r = rows[i];
    const satzart = clean(r[col.satzart] ?? null);
    if (!/^\d+$/.test(satzart)) continue; // footnotes and blank rows
    const rowNo = i + 1;
    const name = clean(r[col.name] ?? null);

    if (satzart === SATZART_LAND) {
      states.set(digits(r[col.land], 2, "Land", rowNo), name);
      continue;
    }
    if (satzart === SATZART_KREIS) {
      const key = digits(r[col.land], 2, "Land", rowNo) + digits(r[col.rb], 1, "RB", rowNo) + digits(r[col.kreis], 2, "Kreis", rowNo);
      districts.set(key, name);
      continue;
    }
    if (satzart !== SATZART_GEMEINDE) continue;

    const land = digits(r[col.land], 2, "Land", rowNo);
    const kreisKey = land + digits(r[col.rb], 1, "RB", rowNo) + digits(r[col.kreis], 2, "Kreis", rowNo);
    const ags = kreisKey + digits(r[col.gem], 3, "Gem", rowNo);
    const textkennzeichen = clean(r[col.textkennzeichen] ?? null);
    if (!name) throw new Error(`row ${rowNo}: municipality ${ags} has no name`);
    if (TEXTKENNZEICHEN_GEMEINDEFREI.has(textkennzeichen)) {
      excluded.push({ ags, name, textkennzeichen });
      continue;
    }
    if (seen.has(ags)) throw new Error(`row ${rowNo}: duplicate AGS ${ags}`);
    seen.add(ags);

    const state = states.get(land);
    if (!state) throw new Error(`row ${rowNo}: no Land row for code ${land} before municipality ${ags}`);

    let population: number | null;
    let lat: number | null;
    let lng: number | null;
    try {
      population = parseGermanInteger(r[col.population] ?? null);
      lng = parseGermanDecimal(r[col.lng] ?? null);
      lat = parseGermanDecimal(r[col.lat] ?? null);
    } catch (e) {
      throw new Error(`row ${rowNo} (${ags} ${name}): ${(e as Error).message}`);
    }
    // Both coordinates or none: half a coordinate is not a location.
    if (lat === null || lng === null) {
      lat = null;
      lng = null;
    } else if (lat < 47 || lat > 55.1 || lng < 5.8 || lng > 15.1) {
      throw new Error(`row ${rowNo} (${ags} ${name}): coordinate ${lat},${lng} lies outside Germany`);
    }

    const notes = [lat === null && "missing_coordinates", population === null && "missing_population"].filter(Boolean);
    settlements.push({
      ags,
      name,
      state,
      district: districts.get(kreisKey) ?? null,
      lat,
      lng,
      population,
      populationAsOf: population === null ? null : populationAsOf,
      scanMode: lat === null ? "none" : "coordinate",
      scanNote: notes.length ? notes.join(",") : null,
    });
  }

  const byState: Record<string, number> = {};
  for (const s of settlements) byState[s.state] = (byState[s.state] ?? 0) + 1;
  return {
    settlements,
    header,
    populationAsOf,
    summary: {
      municipalities: settlements.length,
      byState,
      missingCoordinates: settlements.filter((s) => s.lat === null).length,
      missingPopulation: settlements.filter((s) => s.population === null).length,
      missingBoth: settlements.filter((s) => s.lat === null && s.population === null).length,
      excludedGemeindefrei: excluded,
    },
  };
}

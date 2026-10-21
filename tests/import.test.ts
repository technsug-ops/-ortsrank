import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  findHeader,
  germanDateToIso,
  headerLabel,
  parseGemeindeverzeichnis,
  parseGermanDecimal,
  parseGermanInteger,
  type Cell,
} from "@/lib/destatis";
import { importMain, parseImportArgs, readGvRows } from "@/lib/import-settlements";
import { readSettlementFile } from "@/lib/settlements";

// Synthetic sheet shaped like 31122025_Auszug_GV.xlsx: title, blank row, three
// header rows with footnote digits, data rows, footnotes. Values are invented.
const W = 20;
const row = (...cells: Cell[]) => [...cells, ...Array(Math.max(0, W - cells.length)).fill(null)] as Cell[];
const HEADER: Cell[][] = [
  row("Gemeinden in Deutschland nach Fläche, Bevölkerung und Postleitzahl am 31.12.2025 (Jahr)"),
  row(),
  row("Satzart", "Textkennzeichen", "Amtlicher Regionalschlüssel (ARS)", null, null, null, null, "Gemeindename", "Fläche km2 1)",
    "Bevölkerung auf Grundlage des Zensus 20222)", null, null, null, "Postleitzahl3)", "Geografische Mittelpunktkoordinaten", null, "Reisegebiete"),
  row(null, null, "Land", "RB", "Kreis", "VB", "Gem", null, null, "insgesamt", "männlich", "weiblich", "je km2", null, "Längengrad", "Breitengrad"),
  row(null, null, "Gebietsstand am 31.12.2025 (Jahr)", null, null, null, null, null, "31.12.2025 (Jahr)", "31.12.2025 (Jahr)",
    null, null, null, null, "Zuordnungsstand am 31.12.2024"),
  row(),
];
const gem = (tk: string, land: string, rb: string, kreis: string, vb: string, g: string, name: string, pop: Cell, lng: Cell, lat: Cell) =>
  row("60", tk, land, rb, kreis, vb, g, name, 10.5, pop, null, null, null, "12345", lng, lat);
const DATA: Cell[][] = [
  row("10", null, "06", null, null, null, null, "Hessen"),
  row("20", null, "06", "4", null, null, null, "Reg.-Bez. Darmstadt"),
  row("40", "41", "06", "4", "12", null, null, "Frankfurt am Main, Stadt"),
  row("50", "50", "06", "4", "12", "0000", null, "Frankfurt am Main, Stadt"),
  gem("61", "06", "4", "12", "0000", "000", "Frankfurt am Main, Stadt", 760656, "8,682433", "50,11088"),
  row("40", "44", "06", "4", "34", null, null, "Hochtaunuskreis"),
  gem("63", "06", "4", "34", "0008", "008", "Oberursel (Taunus), Stadt", "46.757", "8,582282", "50,200588"),
  gem("64", "06", "4", "34", "0009", "009", "Ohnekoord", 5000, null, null),
  gem("64", "06", "4", "34", "0010", "010", "Ohnenpop", null, "8,5", "50,2"),
  gem("64", "06", "4", "34", "0011", "011", "Ohnealles", "", "", ""),
  gem("64", "06", "4", "34", "0012", "012", "Halbkoord", 1200, "8,5", null),
  gem("66", "06", "4", "34", "0000", "999", "Forst, gemfr. Gebiet", 0, "8,4", "50,3"),
  gem("65", "06", "4", "34", "0000", "998", "Übungsplatz, gemfr. Bezirk", 700, "8,4", "50,3"),
  row("10", null, "11", null, null, null, null, "Berlin"),
  row("40", "41", "11", "0", "00", null, null, "Berlin, Stadt"),
  gem("61", "11", "0", "00", "0000", "000", "Berlin, Stadt", 3700577, "13,405538", "52,51767"),
  row(),
  row("Quelle: Gemeindeverzeichnis-Informationssytem GV-ISys"),
  row("2) Da die Bevölkerung ab Berichtsjahr 2024 auf der Grundlage des Zensus 2022 basiert, …"),
];
const ROWS = [...HEADER, ...DATA];

let dir: string;
let xlsx: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "ortsrank-import-"));
  xlsx = join(dir, "sample_GV.xlsx");
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Inhalt").addRow(["Gemeindeverzeichnis"]);
  const ws = wb.addWorksheet("Onlineprodukt_Gemeinden");
  for (const r of ROWS) ws.addRow(r.map((c) => c ?? undefined));
  await wb.xlsx.writeFile(xlsx);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("number and header helpers", () => {
  it.each([
    [1234, 1234],
    ["1.234", 1234],
    ["1 234 567", 1234567],
    ["760656", 760656],
    ["", null],
    ["-", null],
    [null, null],
  ])("parseGermanInteger(%j) = %j", (input, expected) => {
    expect(parseGermanInteger(input as Cell)).toBe(expected);
  });

  it.each([["1,5"], ["12.34"], ["abc"]])("parseGermanInteger rejects %j", (input) => {
    expect(() => parseGermanInteger(input)).toThrow();
  });
  it("parseGermanInteger rejects a fraction", () => expect(() => parseGermanInteger(1.5)).toThrow());

  it.each([
    ["8,6821", 8.6821],
    ["50", 50],
    [8.6821, 8.6821],
    ["", null],
    [null, null],
  ])("parseGermanDecimal(%j) = %j", (input, expected) => {
    expect(parseGermanDecimal(input as Cell)).toBe(expected);
  });

  it.each([["8.682.1"], ["1.234,5"], ["x"]])("parseGermanDecimal rejects %j", (input) => {
    expect(() => parseGermanDecimal(input)).toThrow();
  });

  it.each([
    ["Bevölkerung auf Grundlage des Zensus 20222)", "Bevölkerung auf Grundlage des Zensus 2022"],
    ["Postleitzahl3)", "Postleitzahl"],
    ["Fläche km2 1)", "Fläche km2"],
    ["31.12.2025 (Jahr)", "31.12.2025 (Jahr)"],
    ["Amtlicher Regionalschlüssel (ARS)", "Amtlicher Regionalschlüssel (ARS)"],
  ])("headerLabel(%j) = %j", (input, expected) => {
    expect(headerLabel(input)).toBe(expected);
  });

  it("converts the German header date", () => {
    expect(germanDateToIso("31.12.2025 (Jahr)")).toBe("2025-12-31");
    expect(germanDateToIso(null)).toBeNull();
  });
});

describe("findHeader", () => {
  it("finds columns by header text across the header rows", () => {
    const h = findHeader(ROWS);
    expect(h.columns).toEqual({ satzart: 0, textkennzeichen: 1, land: 2, rb: 3, kreis: 4, gem: 6, name: 7, population: 9, lng: 14, lat: 15 });
    expect(h.dataStart).toBe(6);
    expect(h.populationDateText).toBe("31.12.2025 (Jahr)");
  });

  it("finds columns even when they move", () => {
    // Swap longitude and latitude and add a column in front of the name.
    const moved = ROWS.map((r) => {
      const c = [...r];
      [c[14], c[15]] = [c[15], c[14]];
      c.splice(7, 0, null);
      return c;
    });
    const h = findHeader(moved);
    expect(h.columns).toMatchObject({ name: 8, population: 10, lat: 15, lng: 16 });
  });

  it("stops when a required column is missing", () => {
    const noLat = ROWS.map((r, i) => (i === 3 ? r.map((c) => (c === "Breitengrad" ? "Höhe" : c)) : r));
    expect(() => findHeader(noLat)).toThrow(/required column "Breitengrad" not found/);
    expect(() => findHeader([row("Titel"), row("x")])).toThrow(/"Satzart" not found/);
  });
});

describe("parseGemeindeverzeichnis", () => {
  const parsed = parseGemeindeverzeichnis(ROWS);
  const byAgs = (ags: string) => parsed.settlements.find((s) => s.ags === ags);

  it("takes municipality rows only and builds the 8-digit AGS without VB", () => {
    expect(parsed.settlements.map((s) => s.ags)).toEqual(["06412000", "06434008", "06434009", "06434010", "06434011", "06434012", "11000000"]);
  });

  it("fills state and district names from Land and Kreis rows", () => {
    expect(byAgs("06434008")).toMatchObject({ name: "Oberursel (Taunus), Stadt", state: "Hessen", district: "Hochtaunuskreis" });
    expect(byAgs("11000000")).toMatchObject({ state: "Berlin", district: "Berlin, Stadt" });
  });

  it("converts German number formats", () => {
    expect(byAgs("06412000")).toMatchObject({ population: 760656, lat: 50.11088, lng: 8.682433, populationAsOf: "2025-12-31" });
    expect(byAgs("06434008")).toMatchObject({ population: 46757, lat: 50.200588, lng: 8.582282 });
  });

  it("marks the three missing-data cases separately and invents nothing", () => {
    expect(byAgs("06434009")).toMatchObject({ lat: null, lng: null, population: 5000, scanMode: "none", scanNote: "missing_coordinates" });
    expect(byAgs("06434010")).toMatchObject({ lat: 50.2, population: null, populationAsOf: null, scanMode: "coordinate", scanNote: "missing_population" });
    expect(byAgs("06434011")).toMatchObject({ lat: null, population: null, scanMode: "none", scanNote: "missing_coordinates,missing_population" });
  });

  it("treats half a coordinate as no coordinate", () => {
    expect(byAgs("06434012")).toMatchObject({ lat: null, lng: null, scanMode: "none", scanNote: "missing_coordinates" });
  });

  it("excludes unincorporated areas but reports them", () => {
    expect(parsed.summary.excludedGemeindefrei).toEqual([
      { ags: "06434999", name: "Forst, gemfr. Gebiet", textkennzeichen: "66" },
      { ags: "06434998", name: "Übungsplatz, gemfr. Bezirk", textkennzeichen: "65" },
    ]);
  });

  it("summarises totals, states and missing data", () => {
    expect(parsed.summary).toMatchObject({
      municipalities: 7,
      byState: { Hessen: 6, Berlin: 1 },
      missingCoordinates: 3,
      missingPopulation: 2,
      missingBoth: 1,
    });
  });

  it("uses --as-of over the header date", () => {
    expect(parseGemeindeverzeichnis(ROWS, { asOf: "2024-12-31" }).settlements[0].populationAsOf).toBe("2024-12-31");
  });

  it("rejects duplicates, coordinates outside Germany and unparsable numbers", () => {
    const i = ROWS.findIndex((r) => r[7] === "Oberursel (Taunus), Stadt");
    const dup = [...ROWS.slice(0, i + 1), ROWS[i], ...ROWS.slice(i + 1)];
    expect(() => parseGemeindeverzeichnis(dup)).toThrow(/duplicate AGS 06434008/);
    const swapped = ROWS.map((r) => (r[7] === "Oberursel (Taunus), Stadt" ? r.map((c, i) => (i === 14 ? "50,2" : i === 15 ? "8,58" : c)) : r));
    expect(() => parseGemeindeverzeichnis(swapped)).toThrow(/outside Germany/);
    const bad = ROWS.map((r) => (r[7] === "Oberursel (Taunus), Stadt" ? r.map((c, i) => (i === 9 ? "46,757" : c)) : r));
    expect(() => parseGemeindeverzeichnis(bad)).toThrow(/Oberursel.*not an integer/);
  });
});

describe("XLSX import end to end", () => {
  it("reads the sheet with the Satzart header from a real XLSX file", async () => {
    const { sheet, rows } = await readGvRows(xlsx);
    expect(sheet).toBe("Onlineprodukt_Gemeinden");
    expect(parseGemeindeverzeichnis(rows).summary.municipalities).toBe(7);
  });

  it("writes data/settlements.de.json with source and checksum, and reports the mapping", async () => {
    const out = join(dir, "data", "settlements.de.json");
    const lines: string[] = [];
    const code = await importMain(["--file", xlsx, "--out", out], {}, { out: (l) => lines.push(l), now: () => new Date("2026-10-21T00:00:00Z") });
    expect(code).toBe(0);
    const file = readSettlementFile(out);
    expect(file).toMatchObject({ source: "destatis-gv-isys", sourceFile: "sample_GV.xlsx", asOf: "2025-12-31", generatedAt: "2026-10-21T00:00:00.000Z" });
    expect(file.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.settlements).toHaveLength(7);
    const text = lines.join("\n");
    expect(text).toMatch(/AGS = Land 3 .* \+ RB 4 "RB" \+ Kreis 5 "Kreis" \+ Gem 7 "Gem"/);
    expect(text).toMatch(/missing coordinates: 3 · missing population: 2 · both: 1/);
    expect(text).toMatch(/inhabited: 06434998 Übungsplatz/);
    expect(JSON.parse(readFileSync(out, "utf8")).settlements[0].ags).toBe("06412000");
  });

  it("--db upserts the parsed settlements and needs DATABASE_URL", async () => {
    const out = join(dir, "db", "s.json");
    const seen: number[] = [];
    const upsert = async (_url: string, rows: readonly unknown[]) => {
      seen.push(rows.length);
      return rows.length;
    };
    expect(await importMain(["--file", xlsx, "--out", out, "--db"], { DATABASE_URL: "postgres://x" }, { out: () => {}, upsert })).toBe(0);
    expect(seen).toEqual([7]);
    const lines: string[] = [];
    expect(await importMain(["--file", xlsx, "--out", out, "--db"], {}, { out: (l) => lines.push(l), upsert })).toBe(1);
    expect(lines.join("\n")).toMatch(/--db needs DATABASE_URL/);
  });

  it("validates arguments", () => {
    expect(() => parseImportArgs([])).toThrow(/--file is required/);
    expect(() => parseImportArgs(["--file", "x", "--as-of", "31.12.2025"])).toThrow(/YYYY-MM-DD/);
  });
});

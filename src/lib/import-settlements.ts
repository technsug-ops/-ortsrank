/**
 * Import behind scripts/import-settlements.ts (PHASE1_PLAN 5.1):
 * Destatis XLSX → data/settlements.de.json (+ --db upsert into Neon).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parseArgs } from "node:util";
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { settlements as settlementsTable } from "@/db/schema";
import { parseGemeindeverzeichnis, type Cell, type ParsedGv } from "@/lib/destatis";
import { DEFAULT_SETTLEMENTS_FILE, settlementFileSchema, type Settlement, type SettlementFile } from "@/lib/settlements";

export const SOURCE = "destatis-gv-isys";

export interface ImportArgs {
  file: string;
  asOf: string | null;
  db: boolean;
  out: string;
}

export const IMPORT_USAGE = `Usage:
  npx tsx scripts/import-settlements.ts --file <xlsx> [--as-of YYYY-MM-DD] [--out ${DEFAULT_SETTLEMENTS_FILE}] [--db]`;

export function parseImportArgs(argv: string[]): ImportArgs {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: { file: { type: "string" }, "as-of": { type: "string" }, db: { type: "boolean" }, out: { type: "string" } },
  });
  if (!values.file) throw new Error("--file is required");
  const asOf = values["as-of"] ?? null;
  if (asOf !== null && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("--as-of must be YYYY-MM-DD");
  return { file: values.file, asOf, db: values.db === true, out: values.out ?? DEFAULT_SETTLEMENTS_FILE };
}

function toCell(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("result" in v) return toCell((v.result ?? null) as ExcelJS.CellValue);
  if ("text" in v) return String(v.text);
  return null;
}

/** Rows of the sheet that holds the "Satzart" header, as 0-based arrays. */
export async function readGvRows(file: string): Promise<{ sheet: string; rows: Cell[][] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  for (const ws of wb.worksheets) {
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const values = row.values as ExcelJS.CellValue[];
      rows[n - 1] = values.slice(1).map(toCell);
    });
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
    if (rows.some((r) => typeof r[0] === "string" && r[0].trim() === "Satzart")) return { sheet: ws.name, rows };
  }
  throw new Error(`${file}: no sheet with a "Satzart" header`);
}

export function buildSettlementFile(parsed: ParsedGv, sourcePath: string, sha256: string, now: Date): SettlementFile {
  return settlementFileSchema.parse({
    source: SOURCE,
    sourceFile: basename(sourcePath),
    sourceSha256: sha256,
    asOf: parsed.populationAsOf,
    generatedAt: now.toISOString(),
    settlements: parsed.settlements,
  });
}

export function formatImportSummary(parsed: ParsedGv, sheet: string): string {
  const s = parsed.summary;
  const c = parsed.header.columns;
  const col = (i: number) => `${i + 1} "${parsed.header.labels[i]}"`;
  return [
    `Sheet "${sheet}", data from row ${parsed.header.dataStart + 1}; population as of ${parsed.populationAsOf}`,
    "Column mapping (by header text):",
    `  Satzart ${col(c.satzart)} · Textkennzeichen ${col(c.textkennzeichen)}`,
    `  AGS = Land ${col(c.land)} + RB ${col(c.rb)} + Kreis ${col(c.kreis)} + Gem ${col(c.gem)}`,
    `  Name ${col(c.name)} · Population ${col(c.population)}`,
    `  Longitude ${col(c.lng)} · Latitude ${col(c.lat)}`,
    `Municipalities: ${s.municipalities}`,
    `  by state: ${Object.entries(s.byState).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `  missing coordinates: ${s.missingCoordinates} · missing population: ${s.missingPopulation} · both: ${s.missingBoth}`,
    `Excluded unincorporated areas (gemeindefrei, Textkennzeichen 65/66): ${s.excludedGemeindefrei.length}`,
    ...s.excludedGemeindefrei
      .filter((e) => e.textkennzeichen === "65")
      .map((e) => `  inhabited: ${e.ags} ${e.name}`),
  ].join("\n");
}

const UPSERT_BATCH = 500;

export async function upsertSettlements(databaseUrl: string, rows: readonly Settlement[]): Promise<number> {
  const db = drizzle(neon(databaseUrl));
  let written = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH).map((s) => ({ ...s, country: "DE", source: SOURCE }));
    await db
      .insert(settlementsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: settlementsTable.ags,
        set: {
          name: sql`excluded.name`,
          state: sql`excluded.state`,
          district: sql`excluded.district`,
          population: sql`excluded.population`,
          populationAsOf: sql`excluded.population_as_of`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          source: sql`excluded.source`,
          scanMode: sql`excluded.scan_mode`,
          scanNote: sql`excluded.scan_note`,
        },
      });
    written += batch.length;
  }
  return written;
}

export interface ImportDeps {
  out?: (line: string) => void;
  now?: () => Date;
  upsert?: typeof upsertSettlements;
}

export async function importMain(argv: string[], env: Record<string, string | undefined>, deps: ImportDeps = {}): Promise<number> {
  const out = deps.out ?? ((l: string) => console.log(l));
  try {
    const args = parseImportArgs(argv);
    const sha256 = createHash("sha256").update(readFileSync(args.file)).digest("hex");
    const { sheet, rows } = await readGvRows(args.file);
    const parsed = parseGemeindeverzeichnis(rows, { asOf: args.asOf });
    const file = buildSettlementFile(parsed, args.file, sha256, (deps.now ?? (() => new Date()))());
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify(file, null, 2)}\n`, "utf8");
    out(`Source ${file.sourceFile} (sha256 ${sha256.slice(0, 12)}…)`);
    out(formatImportSummary(parsed, sheet));
    out(`Written to ${args.out}`);
    if (args.db) {
      if (!env.DATABASE_URL) throw new Error("--db needs DATABASE_URL");
      const n = await (deps.upsert ?? upsertSettlements)(env.DATABASE_URL, file.settlements);
      out(`Upserted ${n} settlements into the database`);
    }
    return 0;
  } catch (e) {
    out(`Error: ${(e as Error).message}`);
    if (/required|must be|Unknown option/.test((e as Error).message)) out(IMPORT_USAGE);
    return 1;
  }
}

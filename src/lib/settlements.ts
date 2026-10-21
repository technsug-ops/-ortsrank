/**
 * Settlement list file (data/settlements.de.json), produced by
 * scripts/import-settlements.ts from the Destatis Gemeindeverzeichnis
 * (PHASE1_PLAN 5.1) and read by the scan. Missing data stays null with a
 * reason; nothing is filled in from neighbours (CLAUDE.md principle 1).
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { scanMode } from "@/db/schema";

export const DEFAULT_SETTLEMENTS_FILE = "data/settlements.de.json";

export const settlementSchema = z.object({
  ags: z.string().regex(/^\d{8}$/),
  name: z.string().min(1),
  state: z.string().min(1),
  district: z.string().nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  population: z.number().int().nonnegative().nullable(),
  populationAsOf: z.string().nullable(),
  scanMode: z.enum(scanMode.enumValues),
  /** Comma-separated reasons, e.g. "missing_coordinates,missing_population". */
  scanNote: z.string().nullable(),
});

export const settlementFileSchema = z.object({
  source: z.string().min(1),
  sourceFile: z.string().min(1),
  /** SHA-256 of the source file, so the list can be traced to the exact download. */
  sourceSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  asOf: z.string().nullable(),
  generatedAt: z.string(),
  settlements: z.array(settlementSchema),
});

export type Settlement = z.infer<typeof settlementSchema>;
export type SettlementFile = z.infer<typeof settlementFileSchema>;

export function readSettlementFile(path: string): SettlementFile {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`cannot read settlement file ${path}: ${(e as Error).message}`);
  }
  const r = settlementFileSchema.safeParse(json);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new Error(`invalid settlement file ${path}: ${first.path.join(".")}: ${first.message}`);
  }
  return r.data;
}

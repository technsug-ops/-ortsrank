/**
 * Destatis Gemeindeverzeichnis XLSX → data/settlements.de.json (PHASE1_PLAN 5.1).
 *   npx tsx scripts/import-settlements.ts --file data/source/31122025_Auszug_GV.xlsx [--db]
 */
import { config } from "dotenv";
import { importMain } from "@/lib/import-settlements";

config({ path: ".env.local", quiet: true });

importMain(process.argv.slice(2), process.env).then((code) => {
  process.exitCode = code;
});

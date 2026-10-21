/**
 * Scan CLI (PHASE1_PLAN 5.8). Dry-run by default; live requests only with --live.
 *   npx tsx scripts/scan.ts --project projects/pilot-rhein-main.json --dry-run
 */
import { config } from "dotenv";
import { main } from "@/lib/scan-run";

config({ path: ".env.local", quiet: true });

main(process.argv.slice(2), process.env).then((code) => {
  process.exitCode = code;
});

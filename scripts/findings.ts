/**
 * Rules v0 findings for one scan (docs/RULES_V0.md). Reads runs, no API requests.
 *   npx tsx scripts/findings.ts --scan-id <id>
 */
import { findingsMain } from "@/lib/rules/findings-run";

findingsMain(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});

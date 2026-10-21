/**
 * Findings behind scripts/findings.ts: loads a scan, applies rules v0 and
 * writes runs/scans/<scanId>/findings.json. Read-only towards the API.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { competitorLabel } from "@/db/schema";
import { normalizeDomain } from "@/lib/dataforseo/parse";
import { DEFAULT_LABELS_FILE, type CompetitorLabel } from "@/lib/rules/config";
import { evaluate, type Evaluation, type Labels } from "@/lib/rules/engine";
import { loadScan } from "@/lib/rules/measurements";

export const FINDINGS_USAGE = `Usage:
  npx tsx scripts/findings.ts --scan-id <id> [--runs-dir runs] [--labels ${DEFAULT_LABELS_FILE}]

Labels file: {"domain.de": "local" | "regional" | "national" | "portal" | "directory" | "manufacturer", ...}
Domains without a label stay "nicht eingeordnet".`;

const labelsFileSchema = z.record(z.string(), z.enum(competitorLabel.enumValues));

/** Reads the curated label list; a missing file means no labels. */
export function readLabels(path: string): { labels: Labels; found: boolean } {
  if (!existsSync(path)) return { labels: new Map(), found: false };
  const r = labelsFileSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(`invalid labels file ${path}: ${i.path.join(".")}: ${i.message}`);
  }
  const labels = new Map<string, CompetitorLabel>();
  for (const [domain, label] of Object.entries(r.data)) labels.set(normalizeDomain(domain), label);
  return { labels, found: true };
}

export function formatEvaluation(e: Evaluation): string {
  const lines: string[] = [`Rules v${e.rulesVersion} · scan ${e.scanId} · ${e.plannedSettlements} planned settlements`, ""];
  lines.push("Status (settlement · keyword · valid/planned · organic · local pack · ads):");
  for (const c of e.statusTable) {
    lines.push(`  ${c.settlement} · ${c.keyword} · ${c.validSamples}/${c.plannedSamples}${c.failedSamples ? ` (${c.failedSamples} failed or unusable)` : ""} · ${c.organic} · ${c.localPack} · ${c.ads}`);
  }
  const level = { observation: "Beobachtung", inference: "Ableitung", hypothesis: "Hypothese" } as const;
  for (const rule of ["organic_gap", "local_pack_gap", "competitor_coverage", "ad_observation", "review_priority"] as const) {
    const fs = e.findings.filter((f) => f.rule === rule);
    if (!fs.length) continue;
    lines.push("", `[${rule}] ${fs.length}`);
    if (rule === "review_priority" && e.priorityIntro) lines.push(`  ${e.priorityIntro}`);
    for (const f of fs) {
      lines.push(`  (${level[f.evidenceLevel]}) ${f.text}`);
      if (rule !== "review_priority") for (const l of f.limits) lines.push(`    Hinweis: ${l}`);
      for (const a of e.actions.filter((x) => x.findingId === f.id)) lines.push(`    → ${a.type}/${a.bucket}: ${a.text}`);
    }
  }
  if (e.manualReview.length) lines.push("", "Manuell einordnen:", ...e.manualReview.map((m) => `  ${m}`));
  return lines.join("\n");
}

export async function findingsMain(argv: string[], deps: { out?: (l: string) => void } = {}): Promise<number> {
  const out = deps.out ?? ((l: string) => console.log(l));
  try {
    const { values } = parseArgs({
      args: argv,
      strict: true,
      options: { "scan-id": { type: "string" }, "runs-dir": { type: "string" }, labels: { type: "string" } },
    });
    if (!values["scan-id"]) throw new Error("--scan-id is required");
    const runsDir = values["runs-dir"] ?? "runs";
    const labelsPath = values.labels ?? DEFAULT_LABELS_FILE;
    const { labels, found } = readLabels(labelsPath);
    if (!found) out(`No labels file at ${labelsPath}: every competitor stays "nicht eingeordnet" and gap rules cannot fire.`);
    const scan = loadScan(runsDir, values["scan-id"]);
    const evaluation = evaluate(scan, labels);
    const dir = join(runsDir, "scans", scan.scanId);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "findings.json");
    writeFileSync(file, `${JSON.stringify({ ...evaluation, runs: scan.runIds, labelsFile: found ? labelsPath : null }, null, 2)}\n`, "utf8");
    out(formatEvaluation(evaluation));
    out(`Written to ${file}`);
    return 0;
  } catch (e) {
    out(`Error: ${(e as Error).message}`);
    if (/required|Unknown option/.test((e as Error).message)) out(FINDINGS_USAGE);
    return 1;
  }
}

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "dataforseo");

export type FixtureName =
  | "success-mixed"
  | "success-no-local-pack"
  | "success-empty-items"
  | "error-task"
  | "error-top-level";

/** Parsed synthetic DataForSEO response. Shape is unchecked on purpose. */
export function loadFixture(name: FixtureName): unknown {
  return JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8"));
}

export function fixtureNames(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

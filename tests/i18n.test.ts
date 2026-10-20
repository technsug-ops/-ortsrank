import { describe, expect, it } from "vitest";
import de from "@/i18n/dictionaries/de.json";
import en from "@/i18n/dictionaries/en.json";
import tr from "@/i18n/dictionaries/tr.json";

// Collects every leaf key as a dotted path, e.g. "meta.title".
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n dictionaries", () => {
  const reference = keyPaths(de).sort();

  it.each([
    ["en", en],
    ["tr", tr],
  ])("%s has the same keys as de", (_locale, dictionary) => {
    expect(keyPaths(dictionary).sort()).toEqual(reference);
  });
});

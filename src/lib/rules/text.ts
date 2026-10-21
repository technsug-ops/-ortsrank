/**
 * Report sentence templates (German, pilot report language). Single source:
 * src/i18n/report/de.json. Every placeholder must be filled.
 */
import reportDe from "@/i18n/report/de.json";

export type ReportText = typeof reportDe;
export const reportText: ReportText = reportDe;

export function fill(template: string, params: Record<string, string | number>): string {
  const out = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in params)) throw new Error(`missing placeholder {${key}} in "${template.slice(0, 50)}…"`);
    return String(params[key]);
  });
  return out;
}

/** German number with comma, e.g. 0.75 → "0,75". */
export const deNumber = (n: number, digits = 2) => n.toFixed(digits).replace(".", ",");

/** "2026-10-21 07:00:12 +00:00" or ISO → "21.10.2026". */
export function deDate(value: string | null): string {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "Datum unbekannt";
}

/** Joins with commas and "und" before the last item. */
export function deList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} und ${items.at(-1)}`;
}

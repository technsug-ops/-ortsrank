/**
 * DataForSEO Live Advanced response → organic / ad / local_pack rows.
 * See PHASE1_PLAN 5.5. Other item types are counted, not turned into rows.
 *
 * A target domain that is absent is reported as "not found within the
 * scanned depth", never as "not visible" (CLAUDE.md principle 4). Failed
 * responses produce no target verdict at all.
 */
import type { z } from "zod";
import type { resultType } from "@/db/schema";
import { profileIdFromUrl, type ProfileIdStatus } from "@/lib/dataforseo/local-identity";
import {
  STATUS_OK,
  localPackItemSchema,
  organicItemSchema,
  paidItemSchema,
  responseSchema,
  type DfsItem,
} from "@/lib/dataforseo/types";

export type ResultType = (typeof resultType.enumValues)[number];

export interface SerpRow {
  type: ResultType;
  /** Position within its own type (`rank_group`). */
  rank: number;
  /** Position among all items on the page (`rank_absolute`). */
  rankAbsolute: number;
  /** Normalised domain; null for a local business without a website. */
  domain: string | null;
  url: string | null;
  title: string | null;
  /** Ads only: "top" / "bottom" as returned by the provider. */
  adPosition?: string | null;
  /** Local pack only. */
  rating?: number | null;
  votesCount?: number | null;
  phone?: string | null;
  isPaid?: boolean;
  /** Local pack only: profile ids kept apart with their source values (RULES_V0 section 10). */
  cid?: string | null;
  /** svid query parameter of the Google searchviewer URL, unchanged. */
  svid?: string | null;
  /** "/g/…" decoded from svid; null when absent or undecodable (never guessed). */
  googleId?: string | null;
  profileIdStatus?: ProfileIdStatus;
  /** Snippet as returned (address parts are read from it, not from the title). */
  description?: string | null;
}

export interface ItemIssue {
  index: number;
  type: string;
  message: string;
}

export type TargetStatus = "found" | "not_found_within_depth";

export interface TargetMatch {
  domain: string;
  status: TargetStatus;
  /** Best (lowest) rank per type, or null if absent in that type. */
  organicRank: number | null;
  adRank: number | null;
  localPackRank: number | null;
}

export type ParseResult =
  | {
      ok: true;
      taskId: string;
      costUsd: number | null;
      depth: number | null;
      keyword: string | null;
      checkUrl: string | null;
      datetime: string | null;
      rows: SerpRow[];
      /** Item types we do not turn into rows, e.g. people_also_ask. */
      otherTypeCounts: Record<string, number>;
      /** Known types whose item failed validation; never silently dropped. */
      issues: ItemIssue[];
      targets: TargetMatch[];
    }
  | {
      ok: false;
      /** envelope/task: provider reported an error; invalid: unexpected shape. */
      level: "envelope" | "task" | "invalid";
      statusCode: number | null;
      statusMessage: string;
      taskId: string | null;
      costUsd: number | null;
    };

/** Lower-case, trimmed, without a leading "www." or trailing dot. */
export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

function domainOf(domain: string | null, url: string | null): string | null {
  if (domain && domain.trim()) return normalizeDomain(domain);
  if (url) {
    try {
      return normalizeDomain(new URL(url).hostname);
    } catch {
      return null;
    }
  }
  return null;
}

/** google.de, www.google.com, … */
export function isGoogleDomain(domain: string | null): boolean {
  return domain !== null && /^(.+\.)?google\.[a-z.]+$/.test(domain);
}

/**
 * Live responses (checked 21.10.2026) give local pack items domain
 * "www.google.com" and a Google searchviewer URL instead of the business
 * website. That is Google's link, not the business: treat it as no domain.
 */
function localPackDomain(domain: string | null, url: string | null): string | null {
  const d = domainOf(domain, url);
  return isGoogleDomain(d) ? null : d;
}

/** True if `domain` is the target or one of its subdomains. */
export function matchesDomain(domain: string | null, target: string): boolean {
  if (!domain) return false;
  const t = normalizeDomain(target);
  return domain === t || domain.endsWith(`.${t}`);
}

function issuesText(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

type RowOutcome = { row: SerpRow } | { error: string } | null;

function toRow(item: DfsItem): RowOutcome {
  switch (item.type) {
    case "organic": {
      const r = organicItemSchema.safeParse(item);
      if (!r.success) return { error: issuesText(r.error) };
      const d = r.data;
      const domain = domainOf(d.domain, d.url);
      if (!domain) return { error: "organic item without domain or url" };
      return { row: { type: "organic", rank: d.rank_group, rankAbsolute: d.rank_absolute, domain, url: d.url, title: d.title } };
    }
    case "paid": {
      const r = paidItemSchema.safeParse(item);
      if (!r.success) return { error: issuesText(r.error) };
      const d = r.data;
      const domain = domainOf(d.domain, d.url);
      if (!domain) return { error: "paid item without domain or url" };
      return {
        row: {
          type: "ad",
          rank: d.rank_group,
          rankAbsolute: d.rank_absolute,
          domain,
          url: d.url,
          title: d.title,
          adPosition: d.position,
        },
      };
    }
    case "local_pack": {
      const r = localPackItemSchema.safeParse(item);
      if (!r.success) return { error: issuesText(r.error) };
      const d = r.data;
      const id = profileIdFromUrl(d.url);
      return {
        row: {
          type: "local_pack",
          rank: d.rank_group,
          rankAbsolute: d.rank_absolute,
          domain: localPackDomain(d.domain, d.url),
          url: d.url,
          title: d.title,
          rating: d.rating?.value ?? null,
          votesCount: d.rating?.votes_count ?? null,
          phone: d.phone,
          isPaid: d.is_paid,
          cid: d.cid,
          svid: id.svid,
          googleId: id.googleId,
          profileIdStatus: id.status,
          description: d.description,
        },
      };
    }
    default:
      return null;
  }
}

function bestRank(rows: SerpRow[], type: ResultType, target: string): number | null {
  const ranks = rows.filter((r) => r.type === type && matchesDomain(r.domain, target)).map((r) => r.rank);
  return ranks.length ? Math.min(...ranks) : null;
}

export function matchTargets(rows: SerpRow[], targetDomains: readonly string[]): TargetMatch[] {
  return [...new Set(targetDomains.map(normalizeDomain))].map((domain) => {
    const organicRank = bestRank(rows, "organic", domain);
    const adRank = bestRank(rows, "ad", domain);
    const localPackRank = bestRank(rows, "local_pack", domain);
    const found = organicRank !== null || adRank !== null || localPackRank !== null;
    return { domain, status: found ? "found" : "not_found_within_depth", organicRank, adRank, localPackRank };
  });
}

export interface ParseOptions {
  targetDomains?: readonly string[];
}

/** Parses a Live response, which carries exactly one task. */
export function parseLiveResponse(raw: unknown, options: ParseOptions = {}): ParseResult {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, level: "invalid", statusCode: null, statusMessage: issuesText(parsed.error), taskId: null, costUsd: null };
  }
  const res = parsed.data;
  if (res.status_code !== STATUS_OK) {
    return { ok: false, level: "envelope", statusCode: res.status_code, statusMessage: res.status_message, taskId: null, costUsd: res.cost };
  }
  if (res.tasks.length !== 1) {
    return {
      ok: false,
      level: "invalid",
      statusCode: res.status_code,
      statusMessage: `expected exactly 1 task, got ${res.tasks.length}`,
      taskId: null,
      costUsd: res.cost,
    };
  }
  const task = res.tasks[0];
  if (task.status_code !== STATUS_OK) {
    return { ok: false, level: "task", statusCode: task.status_code, statusMessage: task.status_message, taskId: task.id, costUsd: task.cost };
  }

  const result = task.result[0] ?? null;
  const rows: SerpRow[] = [];
  const otherTypeCounts: Record<string, number> = {};
  const issues: ItemIssue[] = [];
  (result?.items ?? []).forEach((item, index) => {
    const outcome = toRow(item);
    if (outcome === null) otherTypeCounts[item.type] = (otherTypeCounts[item.type] ?? 0) + 1;
    else if ("error" in outcome) issues.push({ index, type: item.type, message: outcome.error });
    else rows.push(outcome.row);
  });

  return {
    ok: true,
    taskId: task.id,
    costUsd: task.cost,
    depth: task.data?.depth ?? null,
    keyword: result?.keyword ?? null,
    checkUrl: result?.check_url ?? null,
    datetime: result?.datetime ?? null,
    rows,
    otherTypeCounts,
    issues,
    targets: matchTargets(rows, options.targetDomains ?? []),
  };
}

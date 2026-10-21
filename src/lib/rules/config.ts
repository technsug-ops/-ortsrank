/**
 * Rules v0 thresholds and weights (docs/RULES_V0.md, version 0.2).
 * Single source; change here and in the design document together.
 */
import type { competitorLabel } from "@/db/schema";

export type CompetitorLabel = (typeof competitorLabel.enumValues)[number];

export const RULES_VERSION = "0.2";

/** Organic results counted as "visible" for the rules. */
export const ORGANIC_TOP = 10;

/** organic_gap: distinct local/regional competitors in the top 10, in every valid measurement. */
export const ORGANIC_GAP_MIN_COMPETITORS = 2;
export const ORGANIC_GAP_LABELS: readonly CompetitorLabel[] = ["local", "regional"];

/**
 * local_pack_gap is off during the pilot: Local Pack identity rests on the
 * profile name, and a missing name match does not prove the business is absent.
 */
export const LOCAL_PACK_GAP_ENABLED = false;

/** local_pack_gap: at least this many `local` competitors in a shown Local Pack. */
export const LOCAL_PACK_GAP_MIN_COMPETITORS = 1;
export const LOCAL_PACK_GAP_LABELS: readonly CompetitorLabel[] = ["local"];

/** competitor_coverage: share of measured settlements, inclusive. */
export const COVERAGE_MIN_SHARE = 0.5;

/** Labels listed apart and never treated as local competitors. */
export const NON_COMPETITOR_LABELS: readonly CompetitorLabel[] = ["portal", "directory"];

/** ad_observation: valid measurements from at least this many distinct sessions. */
export const AD_MIN_SESSIONS = 3;

/** review_priority weights (pilot assumption) and gap parts. */
export const PRIORITY_WEIGHTS = { gap: 0.5, population: 0.3, proximity: 0.2 } as const;
export const PRIORITY_GAP_PARTS = { organic: 0.6, localPack: 0.4 } as const;
export const PRIORITY_MAX_ACTIONS = 5;

export const DEFAULT_LABELS_FILE = "data/competitor-labels.json";

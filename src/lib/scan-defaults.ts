/**
 * Single source for scan defaults and provider limits (PHASE1_PLAN 2, 5.3–5.7).
 * Environment variables may override some of these at the script level.
 */

/** Live mode price per 10-result SERP page; override with SCAN_PRICE_PER_SERP_USD. */
export const DEFAULT_PRICE_PER_SERP_USD = 0.002;

/** Results per SERP page; each extra page is billed as one more base price. */
export const RESULTS_PER_SERP = 10;

/** Retries after the first attempt, i.e. at most 3 attempts per task. */
export const DEFAULT_MAX_RETRIES = 2;

/** Assumed share of tasks retried once; used for the expected cost only. */
export const DEFAULT_EXPECTED_RETRY_RATE = 0.2;

/** A session is flagged when its tasks were sent this far from `plannedAt`. */
export const SESSION_DRIFT_TOLERANCE_MINUTES = 60;

/** Time zone in which session `plannedAt` times ("HH:MM") are meant. */
export const SESSION_TIME_ZONE = "Europe/Berlin";

/** Record integrity must be 100 %; valid result rate target (ROADMAP 6). */
export const VALID_RESULT_RATE_TARGET = 0.98;

/** DataForSEO `depth` bounds. */
export const DEPTH_MIN = 1;
export const DEPTH_MAX = 200;

/** DataForSEO `location_coordinate` radius bounds, in millimetres. */
export const POINT_RADIUS_MM_MIN = 199;
export const POINT_RADIUS_MM_MAX = 199_999;

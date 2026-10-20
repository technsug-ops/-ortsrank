/**
 * Ortsrank core schema.
 *
 * Principles
 * - Multi-tenant: every customer-owned row carries `organizationId`.
 * - Real data only: settlements come from the official Destatis
 *   Gemeindeverzeichnis (AGS key). Nothing is entered by hand.
 * - Traceable: every SERP row points to the raw provider response it was
 *   parsed from (`serp_raw`), so every number in a report has a source.
 * - Multi-country ready: `country` columns, DE first.
 *
 * Identity tables (`user`, `session`, `account`, `verification`,
 * `organization`, `member`, `invitation`) follow the Better Auth core schema
 * plus its organization plugin, so Phase 3 plugs in without a second set of
 * user tables. Before Phase 3, regenerate them with the Better Auth CLI and
 * diff against this file. Our own extra fields are marked "additionalField".
 */
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const uid = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").defaultNow().notNull();
const updatedAt = () => ts("updated_at").defaultNow().notNull();

export const uiLocale = pgEnum("ui_locale", ["de", "en", "tr"]);

// ── Plans ─────────────────────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // free | starter | pro | agency
  name: text("name").notNull(),
  monthlyQueryQuota: integer("monthly_query_quota").notNull(),
  maxProjects: integer("max_projects").notNull(),
  maxSeats: integer("max_seats").notNull(),
  whiteLabel: boolean("white_label").default(false).notNull(),
  stripePriceId: text("stripe_price_id"),
});

// ── Identity (Better Auth core + organization plugin) ─────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  locale: uiLocale("locale").default("de").notNull(), // additionalField
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
    activeOrganizationId: text("active_organization_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  planId: text("plan_id").references(() => plans.id).default("free").notNull(), // additionalField
  stripeCustomerId: text("stripe_customer_id"), // additionalField
  reportLocale: uiLocale("report_locale").default("de").notNull(), // additionalField
  createdAt: createdAt(),
});

// Roles: owner | admin | member | viewer (Better Auth stores them as text).
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
    role: text("role").default("member").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("member_org_user_idx").on(t.organizationId, t.userId)],
);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(),
  expiresAt: ts("expires_at").notNull(),
  inviterId: text("inviter_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uid(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }).notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detail: jsonb("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.organizationId, t.createdAt)],
);

// ── Reference data (official, read-only) ──────────────────────────────────

export const scanMode = pgEnum("scan_mode", ["coordinate", "location_code", "none"]);

export const settlements = pgTable(
  "settlements",
  {
    // Amtlicher Gemeindeschlüssel (8 digits) — the only key we trust.
    ags: text("ags").primaryKey(),
    country: text("country").default("DE").notNull(),
    name: text("name").notNull(),
    state: text("state").notNull(), // Bundesland
    district: text("district"), // Kreis
    population: integer("population").notNull(),
    populationAsOf: text("population_as_of").notNull(), // e.g. "2025-12-31"
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    source: text("source").default("destatis-gv-isys").notNull(),
    // How this settlement can be queried. "coordinate" = its own centre point
    // (preferred); "location_code" = provider city code; "none" = not
    // scannable, shown as such in reports and never replaced by a neighbour.
    scanMode: scanMode("scan_mode").default("coordinate").notNull(),
    scanNote: text("scan_note"), // reason when scanMode is "none"
  },
  (t) => [index("settlement_state_idx").on(t.state), index("settlement_pop_idx").on(t.population)],
);

// Fallback mapping AGS → provider city code, only used where coordinate
// queries are not possible. Distance is stored so reports can disclose it.
export const providerLocations = pgTable(
  "provider_locations",
  {
    ags: text("ags").references(() => settlements.ags).notNull(),
    provider: text("provider").default("dataforseo").notNull(),
    locationCode: integer("location_code").notNull(),
    locationName: text("location_name").notNull(),
    distanceKm: doublePrecision("distance_km").notNull(),
  },
  (t) => [primaryKey({ columns: [t.ags, t.provider] })],
);

// ── Projects & keyword sets ───────────────────────────────────────────────

export const device = pgEnum("device", ["mobile", "desktop"]);

export const projects = pgTable(
  "projects",
  {
    id: uid(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    category: text("category").notNull(), // e.g. "terrassenueberdachung"
    centerAgs: text("center_ags").references(() => settlements.ags).notNull(),
    radiusKm: integer("radius_km").default(30).notNull(),
    populationMin: integer("population_min").default(10000).notNull(),
    expansionRadiusKm: integer("expansion_radius_km").default(150).notNull(),
    expansionPopulationMin: integer("expansion_population_min").default(20000).notNull(),
    device: device("device").default("mobile").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("project_org_idx").on(t.organizationId)],
);

export const keywordType = pgEnum("keyword_type", ["main", "variant", "intent", "local"]);

export const keywords = pgTable(
  "keywords",
  {
    id: uid(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    term: text("term").notNull(), // always German: we search google.de
    type: keywordType("type").notNull(),
    weight: integer("weight").default(1).notNull(),
  },
  (t) => [uniqueIndex("keyword_project_term_idx").on(t.projectId, t.term)],
);

// ── Scans, raw responses & parsed results ─────────────────────────────────

export const scanStatus = pgEnum("scan_status", ["queued", "running", "done", "failed"]);
export const ring = pgEnum("ring", ["service", "expansion", "national"]);

export const scans = pgTable(
  "scans",
  {
    id: uid(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }).notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    status: scanStatus("status").default("queued").notNull(),
    queryCount: integer("query_count").default(0).notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).default("0").notNull(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    createdAt: createdAt(),
  },
  (t) => [index("scan_project_idx").on(t.projectId, t.createdAt)],
);

// One row per provider request. Kept 12 months, then deleted (retention job).
export const serpRaw = pgTable(
  "serp_raw",
  {
    id: uid(),
    scanId: uuid("scan_id").references(() => scans.id, { onDelete: "cascade" }).notNull(),
    ags: text("ags").references(() => settlements.ags).notNull(),
    ring: ring("ring").notNull(),
    keywordId: uuid("keyword_id").references(() => keywords.id, { onDelete: "cascade" }).notNull(),
    sample: integer("sample").default(1).notNull(), // repeated pulls for ad frequency
    provider: text("provider").default("dataforseo").notNull(),
    providerTaskId: text("provider_task_id").notNull(),
    scanMode: scanMode("scan_mode").notNull(),
    locationParam: text("location_param").notNull(), // "lat,lng,radius" or location code
    device: device("device").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: ts("fetched_at").notNull(),
  },
  (t) => [
    index("serp_raw_scan_idx").on(t.scanId, t.ags),
    index("serp_raw_fetched_idx").on(t.fetchedAt),
  ],
);

export const resultType = pgEnum("result_type", ["organic", "ad", "local_pack"]);

export const serpResults = pgTable(
  "serp_results",
  {
    id: uid(),
    rawId: uuid("raw_id").references(() => serpRaw.id, { onDelete: "cascade" }).notNull(),
    scanId: uuid("scan_id").references(() => scans.id, { onDelete: "cascade" }).notNull(),
    ags: text("ags").references(() => settlements.ags).notNull(),
    keywordId: uuid("keyword_id").references(() => keywords.id, { onDelete: "cascade" }).notNull(),
    type: resultType("type").notNull(),
    rank: integer("rank").notNull(),
    domain: text("domain").notNull(),
    url: text("url"),
    title: text("title"),
  },
  (t) => [
    index("serp_scan_ags_idx").on(t.scanId, t.ags),
    index("serp_scan_domain_idx").on(t.scanId, t.domain),
  ],
);

// ── Competitor labels ─────────────────────────────────────────────────────

export const competitorLabel = pgEnum("competitor_label", [
  "local", "regional", "national", "portal", "directory", "manufacturer",
]);

export const competitorLabels = pgTable("competitor_labels", {
  domain: text("domain").primaryKey(),
  label: competitorLabel("label").notNull(),
  source: text("source").default("curated").notNull(), // curated | auto
});

// ── Findings & actions ────────────────────────────────────────────────────

export const findingKind = pgEnum("finding_kind", ["opportunity", "threat", "action"]);
export const actionBucket = pgEnum("action_bucket", ["website", "google_profile", "ads", "monitoring"]);
export const actionStatus = pgEnum("action_status", ["open", "done", "dismissed"]);

export const findings = pgTable(
  "findings",
  {
    id: uid(),
    scanId: uuid("scan_id").references(() => scans.id, { onDelete: "cascade" }).notNull(),
    rule: text("rule").notNull(), // e.g. "ad_gap", "local_pack_gap"
    kind: findingKind("kind").notNull(),
    score: integer("score").notNull(),
    ags: text("ags").references(() => settlements.ags),
    keywordId: uuid("keyword_id").references(() => keywords.id),
    competitorDomain: text("competitor_domain"),
    evidence: jsonb("evidence").notNull(),
  },
  (t) => [index("finding_scan_idx").on(t.scanId, t.score)],
);

export const actions = pgTable(
  "actions",
  {
    id: uid(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }).notNull(),
    findingId: uuid("finding_id").references(() => findings.id, { onDelete: "set null" }),
    bucket: actionBucket("bucket").notNull(),
    text: text("text").notNull(),
    locale: uiLocale("locale").notNull(),
    status: actionStatus("status").default("open").notNull(),
    doneAt: ts("done_at"),
    createdAt: createdAt(),
  },
  (t) => [index("action_org_idx").on(t.organizationId, t.status)],
);

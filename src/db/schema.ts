/**
 * Ortsrank core schema.
 *
 * Principles
 * - Multi-tenant: every customer-owned row carries `organizationId`.
 * - Real data only: settlements come from the official Destatis
 *   Gemeindeverzeichnis (AGS key). Nothing is entered by hand.
 * - Traceable: every SERP row keeps the provider task id and raw payload
 *   reference, so every number in a report can be traced to its source.
 * - Multi-country ready: `country` columns, DE first.
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

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

// ── Tenancy ───────────────────────────────────────────────────────────────

export const memberRole = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const uiLocale = pgEnum("ui_locale", ["de", "en", "tr"]);

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // free | starter | pro | agency
  name: text("name").notNull(),
  monthlyQueryQuota: integer("monthly_query_quota").notNull(),
  maxProjects: integer("max_projects").notNull(),
  maxSeats: integer("max_seats").notNull(),
  whiteLabel: boolean("white_label").default(false).notNull(),
  stripePriceId: text("stripe_price_id"),
});

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  planId: text("plan_id").references(() => plans.id).default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  reportLocale: uiLocale("report_locale").default("de").notNull(),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  locale: uiLocale("locale").default("de").notNull(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: memberRole("role").default("member").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    detail: jsonb("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.organizationId, t.createdAt)],
);

// ── Reference data (official, read-only) ──────────────────────────────────

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
  },
  (t) => [index("settlement_state_idx").on(t.state), index("settlement_pop_idx").on(t.population)],
);

// Deterministic mapping AGS → SERP provider location. A settlement without a
// mapping is reported as "not scannable", never silently replaced.
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
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
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
    id: id(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    term: text("term").notNull(), // always German: we search google.de
    type: keywordType("type").notNull(),
    weight: integer("weight").default(1).notNull(),
  },
  (t) => [uniqueIndex("keyword_project_term_idx").on(t.projectId, t.term)],
);

// ── Scans & raw results ───────────────────────────────────────────────────

export const scanStatus = pgEnum("scan_status", ["queued", "running", "done", "failed"]);
export const ring = pgEnum("ring", ["service", "expansion", "national"]);

export const scans = pgTable(
  "scans",
  {
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    status: scanStatus("status").default("queued").notNull(),
    queryCount: integer("query_count").default(0).notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).default("0").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("scan_project_idx").on(t.projectId, t.createdAt)],
);

export const resultType = pgEnum("result_type", ["organic", "ad", "local_pack"]);

export const serpResults = pgTable(
  "serp_results",
  {
    id: id(),
    scanId: uuid("scan_id").references(() => scans.id, { onDelete: "cascade" }).notNull(),
    ags: text("ags").references(() => settlements.ags).notNull(),
    ring: ring("ring").notNull(),
    keywordId: uuid("keyword_id").references(() => keywords.id, { onDelete: "cascade" }).notNull(),
    type: resultType("type").notNull(),
    rank: integer("rank").notNull(),
    domain: text("domain").notNull(),
    url: text("url"),
    title: text("title"),
    sample: integer("sample").default(1).notNull(), // repeated pulls for ad frequency
    providerTaskId: text("provider_task_id").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
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
    id: id(),
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
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    findingId: uuid("finding_id").references(() => findings.id, { onDelete: "set null" }),
    bucket: actionBucket("bucket").notNull(),
    text: text("text").notNull(),
    locale: uiLocale("locale").notNull(),
    status: actionStatus("status").default("open").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("action_org_idx").on(t.organizationId, t.status)],
);

CREATE TYPE "public"."action_bucket" AS ENUM('website', 'google_profile', 'ads', 'monitoring');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('open', 'done', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."competitor_label" AS ENUM('local', 'regional', 'national', 'portal', 'directory', 'manufacturer');--> statement-breakpoint
CREATE TYPE "public"."device" AS ENUM('mobile', 'desktop');--> statement-breakpoint
CREATE TYPE "public"."finding_kind" AS ENUM('opportunity', 'threat', 'action');--> statement-breakpoint
CREATE TYPE "public"."keyword_type" AS ENUM('main', 'variant', 'intent', 'local');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."result_type" AS ENUM('organic', 'ad', 'local_pack');--> statement-breakpoint
CREATE TYPE "public"."ring" AS ENUM('service', 'expansion', 'national');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ui_locale" AS ENUM('de', 'en', 'tr');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"finding_id" uuid,
	"bucket" "action_bucket" NOT NULL,
	"text" text NOT NULL,
	"locale" "ui_locale" NOT NULL,
	"status" "action_status" DEFAULT 'open' NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_labels" (
	"domain" text PRIMARY KEY NOT NULL,
	"label" "competitor_label" NOT NULL,
	"source" text DEFAULT 'curated' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"kind" "finding_kind" NOT NULL,
	"score" integer NOT NULL,
	"ags" text,
	"keyword_id" uuid,
	"competitor_domain" text,
	"evidence" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"term" text NOT NULL,
	"type" "keyword_type" NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"report_locale" "ui_locale" DEFAULT 'de' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_query_quota" integer NOT NULL,
	"max_projects" integer NOT NULL,
	"max_seats" integer NOT NULL,
	"white_label" boolean DEFAULT false NOT NULL,
	"stripe_price_id" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"category" text NOT NULL,
	"center_ags" text NOT NULL,
	"radius_km" integer DEFAULT 30 NOT NULL,
	"population_min" integer DEFAULT 10000 NOT NULL,
	"expansion_radius_km" integer DEFAULT 150 NOT NULL,
	"expansion_population_min" integer DEFAULT 20000 NOT NULL,
	"device" "device" DEFAULT 'mobile' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_locations" (
	"ags" text NOT NULL,
	"provider" text DEFAULT 'dataforseo' NOT NULL,
	"location_code" integer NOT NULL,
	"location_name" text NOT NULL,
	"distance_km" double precision NOT NULL,
	CONSTRAINT "provider_locations_ags_provider_pk" PRIMARY KEY("ags","provider")
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"query_count" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serp_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"ags" text NOT NULL,
	"ring" "ring" NOT NULL,
	"keyword_id" uuid NOT NULL,
	"type" "result_type" NOT NULL,
	"rank" integer NOT NULL,
	"domain" text NOT NULL,
	"url" text,
	"title" text,
	"sample" integer DEFAULT 1 NOT NULL,
	"provider_task_id" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"ags" text PRIMARY KEY NOT NULL,
	"country" text DEFAULT 'DE' NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"district" text,
	"population" integer NOT NULL,
	"population_as_of" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"source" text DEFAULT 'destatis-gv-isys' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"locale" "ui_locale" DEFAULT 'de' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_ags_settlements_ags_fk" FOREIGN KEY ("ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_center_ags_settlements_ags_fk" FOREIGN KEY ("center_ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_locations" ADD CONSTRAINT "provider_locations_ags_settlements_ags_fk" FOREIGN KEY ("ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_ags_settlements_ags_fk" FOREIGN KEY ("ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_org_idx" ON "actions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "finding_scan_idx" ON "findings" USING btree ("scan_id","score");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_project_term_idx" ON "keywords" USING btree ("project_id","term");--> statement-breakpoint
CREATE INDEX "project_org_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scan_project_idx" ON "scans" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "serp_scan_ags_idx" ON "serp_results" USING btree ("scan_id","ags");--> statement-breakpoint
CREATE INDEX "serp_scan_domain_idx" ON "serp_results" USING btree ("scan_id","domain");--> statement-breakpoint
CREATE INDEX "settlement_state_idx" ON "settlements" USING btree ("state");--> statement-breakpoint
CREATE INDEX "settlement_pop_idx" ON "settlements" USING btree ("population");
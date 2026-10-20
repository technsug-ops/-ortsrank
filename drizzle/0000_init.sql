CREATE TYPE "public"."action_bucket" AS ENUM('website', 'google_profile', 'ads', 'monitoring');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('open', 'done', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."competitor_label" AS ENUM('local', 'regional', 'national', 'portal', 'directory', 'manufacturer');--> statement-breakpoint
CREATE TYPE "public"."device" AS ENUM('mobile', 'desktop');--> statement-breakpoint
CREATE TYPE "public"."finding_kind" AS ENUM('opportunity', 'threat', 'action');--> statement-breakpoint
CREATE TYPE "public"."keyword_type" AS ENUM('main', 'variant', 'intent', 'local');--> statement-breakpoint
CREATE TYPE "public"."result_type" AS ENUM('organic', 'ad', 'local_pack');--> statement-breakpoint
CREATE TYPE "public"."ring" AS ENUM('service', 'expansion', 'national');--> statement-breakpoint
CREATE TYPE "public"."scan_mode" AS ENUM('coordinate', 'location_code', 'none');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ui_locale" AS ENUM('de', 'en', 'tr');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
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
	"organization_id" text NOT NULL,
	"user_id" text,
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
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL
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
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"report_locale" "ui_locale" DEFAULT 'de' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
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
	"organization_id" text NOT NULL,
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
	"organization_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"query_count" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serp_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"ags" text NOT NULL,
	"ring" "ring" NOT NULL,
	"keyword_id" uuid NOT NULL,
	"sample" integer DEFAULT 1 NOT NULL,
	"provider" text DEFAULT 'dataforseo' NOT NULL,
	"provider_task_id" text NOT NULL,
	"scan_mode" "scan_mode" NOT NULL,
	"location_param" text NOT NULL,
	"device" "device" NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serp_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"ags" text NOT NULL,
	"keyword_id" uuid NOT NULL,
	"type" "result_type" NOT NULL,
	"rank" integer NOT NULL,
	"domain" text NOT NULL,
	"url" text,
	"title" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
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
	"source" text DEFAULT 'destatis-gv-isys' NOT NULL,
	"scan_mode" "scan_mode" DEFAULT 'coordinate' NOT NULL,
	"scan_note" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"locale" "ui_locale" DEFAULT 'de' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_ags_settlements_ags_fk" FOREIGN KEY ("ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_center_ags_settlements_ags_fk" FOREIGN KEY ("center_ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_locations" ADD CONSTRAINT "provider_locations_ags_settlements_ags_fk" FOREIGN KEY ("ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_raw" ADD CONSTRAINT "serp_raw_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_raw" ADD CONSTRAINT "serp_raw_ags_settlements_ags_fk" FOREIGN KEY ("ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_raw" ADD CONSTRAINT "serp_raw_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_raw_id_serp_raw_id_fk" FOREIGN KEY ("raw_id") REFERENCES "public"."serp_raw"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_ags_settlements_ags_fk" FOREIGN KEY ("ags") REFERENCES "public"."settlements"("ags") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_results" ADD CONSTRAINT "serp_results_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "action_org_idx" ON "actions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "finding_scan_idx" ON "findings" USING btree ("scan_id","score");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_project_term_idx" ON "keywords" USING btree ("project_id","term");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_idx" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "project_org_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scan_project_idx" ON "scans" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "serp_raw_scan_idx" ON "serp_raw" USING btree ("scan_id","ags");--> statement-breakpoint
CREATE INDEX "serp_raw_fetched_idx" ON "serp_raw" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "serp_scan_ags_idx" ON "serp_results" USING btree ("scan_id","ags");--> statement-breakpoint
CREATE INDEX "serp_scan_domain_idx" ON "serp_results" USING btree ("scan_id","domain");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "settlement_state_idx" ON "settlements" USING btree ("state");--> statement-breakpoint
CREATE INDEX "settlement_pop_idx" ON "settlements" USING btree ("population");
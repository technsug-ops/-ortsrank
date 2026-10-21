ALTER TABLE "serp_results" ALTER COLUMN "domain" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "population" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "population_as_of" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "lat" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "lng" DROP NOT NULL;
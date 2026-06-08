ALTER TABLE "properties" ADD COLUMN "source_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "properties_agency_source" ON "properties" USING btree ("agency_id","source_id");
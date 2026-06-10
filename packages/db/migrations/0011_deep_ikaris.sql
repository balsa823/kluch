ALTER TABLE "agencies" ADD COLUMN "ref_prefix" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "ref_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "ref_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "properties_agency_refcode" ON "properties" USING btree ("agency_id","ref_code") WHERE ref_code is not null;
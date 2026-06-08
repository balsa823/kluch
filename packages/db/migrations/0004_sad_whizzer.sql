DO $$ BEGIN
 CREATE TYPE "public"."deal_type" AS ENUM('rent', 'sale');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "deal_type" "deal_type" DEFAULT 'rent' NOT NULL;
ALTER TYPE "property_type" RENAME TO "property_type_old";--> statement-breakpoint
CREATE TYPE "property_type" AS ENUM('residential','land','commercial');--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "type" TYPE "property_type"
  USING (CASE WHEN "type" IS NULL THEN NULL ELSE 'residential'::"property_type" END);--> statement-breakpoint
DROP TYPE "property_type_old";

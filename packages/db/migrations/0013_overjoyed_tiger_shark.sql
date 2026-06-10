ALTER TABLE "agencies" ADD COLUMN "hero_headline" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "hero_image_url" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "favicon_url" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "viber" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "map_url" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "about_blurb" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "footer_name" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "notify_email" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "default_lang" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "observe_holidays" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "business_hours" jsonb;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "custom_closures" jsonb;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "socials" jsonb;
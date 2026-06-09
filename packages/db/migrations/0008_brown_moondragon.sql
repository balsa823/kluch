ALTER TABLE "inquiries" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ALTER COLUMN "contact" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "kind" text DEFAULT 'inquiry' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "visitor_id" uuid;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "tour_date" text;
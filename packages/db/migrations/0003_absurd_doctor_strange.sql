ALTER TABLE "pets" ADD COLUMN "destination" jsonb;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "path" jsonb DEFAULT '[]'::jsonb NOT NULL;
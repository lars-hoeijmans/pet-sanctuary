CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"requested_by_pet_id" text,
	"action_type" text NOT NULL,
	"summary" text NOT NULL,
	"diff_or_summary" text,
	"target_id" text,
	"status" text NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"pet_a_id" text NOT NULL,
	"pet_b_id" text NOT NULL,
	"affinity" integer DEFAULT 0 NOT NULL,
	"trust" integer DEFAULT 0 NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"pet_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"purpose" text,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"triggering_event_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"assigned_pet_id" text,
	"reviewer_pet_id" text,
	"plan_summary" text,
	"output_ref" text,
	"transcript_ref" text,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "runtime" jsonb DEFAULT '{"kind":"deterministic","model":null,"provider":null}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_room_idx" ON "approvals" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "relationships_room_idx" ON "relationships" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "skills_pet_idx" ON "skills" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "tasks_room_idx" ON "tasks" USING btree ("room_id");
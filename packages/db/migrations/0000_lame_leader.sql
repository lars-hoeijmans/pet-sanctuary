CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"actor_pet_id" text,
	"target_pet_id" text,
	"target_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text NOT NULL,
	"significance" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" text PRIMARY KEY NOT NULL,
	"pet_id" text NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"traits" jsonb NOT NULL,
	"personality_summary" text NOT NULL,
	"speaking_style" text NOT NULL,
	"sprite" text NOT NULL,
	"status" text NOT NULL,
	"karma" integer DEFAULT 0 NOT NULL,
	"permissions" jsonb NOT NULL,
	"position" jsonb NOT NULL,
	"current_task_id" text,
	"memory" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"tick" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_state" (
	"room_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"tick" integer DEFAULT 0 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"last_tick_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"type" text NOT NULL,
	"position" jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owner_pet_id" text,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_pet_id_pets_id_fk" FOREIGN KEY ("actor_pet_id") REFERENCES "public"."pets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_target_pet_id_pets_id_fk" FOREIGN KEY ("target_pet_id") REFERENCES "public"."pets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_state" ADD CONSTRAINT "simulation_state_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_objects" ADD CONSTRAINT "world_objects_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_objects" ADD CONSTRAINT "world_objects_owner_pet_id_pets_id_fk" FOREIGN KEY ("owner_pet_id") REFERENCES "public"."pets"("id") ON DELETE set null ON UPDATE no action;
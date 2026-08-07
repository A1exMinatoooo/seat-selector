CREATE TYPE "public"."event_status" AS ENUM('draft', 'open', 'ended');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"name" text NOT NULL,
	"hall_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"radius_meters" integer NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"time_zone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_public_code_unique" UNIQUE("public_code")
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_hall_id_halls_id_fk" FOREIGN KEY ("hall_id") REFERENCES "public"."halls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_location_presets_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_status_starts_at_idx" ON "events" USING btree ("status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_types_event_name_uidx" ON "ticket_types" USING btree ("event_id","name");
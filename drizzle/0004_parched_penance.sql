CREATE TABLE "participant_tickets" (
	"participant_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_first" text NOT NULL,
	"phone_digits" text NOT NULL,
	"phone_last4" text NOT NULL,
	"phone_is_full" boolean NOT NULL,
	"ticket_total" integer NOT NULL,
	"device_hash" text,
	"device_bound_at" timestamp with time zone,
	"location_exempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participant_tickets" ADD CONSTRAINT "participant_tickets_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_tickets" ADD CONSTRAINT "participant_tickets_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participant_tickets_participant_type_uidx" ON "participant_tickets" USING btree ("participant_id","ticket_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_event_phone_uidx" ON "participants" USING btree ("event_id","phone_digits");--> statement-breakpoint
CREATE INDEX "participants_event_last4_idx" ON "participants" USING btree ("event_id","phone_last4");
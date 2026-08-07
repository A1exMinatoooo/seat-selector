CREATE TYPE "public"."audit_action" AS ENUM('event_created', 'event_status_changed', 'participants_imported', 'participant_added', 'device_reset', 'location_exemption_changed', 'selection_reset', 'seat_confirmed', 'seat_conflict');--> statement-breakpoint
CREATE TABLE "event_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid,
	"action" "audit_action" NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_audit_logs" ADD CONSTRAINT "event_audit_logs_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_audit_logs_event_time_idx" ON "event_audit_logs" USING btree ("event_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_audit_logs_participant_idx" ON "event_audit_logs" USING btree ("participant_id");
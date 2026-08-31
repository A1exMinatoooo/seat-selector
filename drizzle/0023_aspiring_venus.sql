ALTER TYPE "public"."audit_action" ADD VALUE 'consecutive_checkin_configuration_changed';--> statement-breakpoint
CREATE TABLE "consecutive_checkin_links" (
	"source_event_id" uuid NOT NULL,
	"target_event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consecutive_checkin_links" ADD CONSTRAINT "consecutive_checkin_links_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_links" ADD CONSTRAINT "consecutive_checkin_links_target_event_id_events_id_fk" FOREIGN KEY ("target_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consecutive_checkin_links_source_target_uidx" ON "consecutive_checkin_links" USING btree ("source_event_id","target_event_id");--> statement-breakpoint
CREATE INDEX "consecutive_checkin_links_target_idx" ON "consecutive_checkin_links" USING btree ("target_event_id");--> statement-breakpoint
CREATE INDEX "consecutive_checkin_links_source_idx" ON "consecutive_checkin_links" USING btree ("source_event_id");
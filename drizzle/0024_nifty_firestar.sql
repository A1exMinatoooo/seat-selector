CREATE TYPE "public"."consecutive_checkin_workflow_status" AS ENUM('active', 'completed', 'cancelled', 'expired');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'consecutive_checkin_workflow_claimed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'consecutive_checkin_workflow_cancelled';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'consecutive_checkin_seats_held';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'consecutive_checkin_completed';--> statement-breakpoint
CREATE TABLE "consecutive_checkin_seat_holds" (
	"workflow_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consecutive_checkin_workflow_events" (
	"workflow_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"allocation" jsonb NOT NULL,
	"historical" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consecutive_checkin_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"source_event_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"status" "consecutive_checkin_workflow_status" DEFAULT 'active' NOT NULL,
	"claimed_at" timestamp (3) with time zone NOT NULL,
	"heartbeat_at" timestamp (3) with time zone NOT NULL,
	"hard_expires_at" timestamp (3) with time zone NOT NULL,
	"completed_at" timestamp (3) with time zone,
	"cancelled_at" timestamp (3) with time zone,
	CONSTRAINT "consecutive_checkin_workflows_issue_id_unique" UNIQUE("issue_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_issue_events" (
	"issue_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"allocation" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consecutive_checkin_seat_holds" ADD CONSTRAINT "consecutive_checkin_seat_holds_workflow_id_consecutive_checkin_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."consecutive_checkin_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_seat_holds" ADD CONSTRAINT "consecutive_checkin_seat_holds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_seat_holds" ADD CONSTRAINT "consecutive_checkin_seat_holds_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_seat_holds" ADD CONSTRAINT "consecutive_checkin_seat_holds_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_workflow_events" ADD CONSTRAINT "consecutive_checkin_workflow_events_workflow_id_consecutive_checkin_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."consecutive_checkin_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_workflow_events" ADD CONSTRAINT "consecutive_checkin_workflow_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_workflow_events" ADD CONSTRAINT "consecutive_checkin_workflow_events_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_workflows" ADD CONSTRAINT "consecutive_checkin_workflows_issue_id_ticket_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."ticket_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consecutive_checkin_workflows" ADD CONSTRAINT "consecutive_checkin_workflows_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_issue_events" ADD CONSTRAINT "ticket_issue_events_issue_id_ticket_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."ticket_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_issue_events" ADD CONSTRAINT "ticket_issue_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consecutive_checkin_seat_holds_event_seat_uidx" ON "consecutive_checkin_seat_holds" USING btree ("event_id","seat_id");--> statement-breakpoint
CREATE INDEX "consecutive_checkin_seat_holds_workflow_idx" ON "consecutive_checkin_seat_holds" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "consecutive_checkin_seat_holds_expiry_idx" ON "consecutive_checkin_seat_holds" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "consecutive_checkin_workflow_events_workflow_event_uidx" ON "consecutive_checkin_workflow_events" USING btree ("workflow_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consecutive_checkin_workflow_events_workflow_order_uidx" ON "consecutive_checkin_workflow_events" USING btree ("workflow_id","sort_order");--> statement-breakpoint
CREATE INDEX "consecutive_checkin_workflow_events_event_idx" ON "consecutive_checkin_workflow_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "consecutive_checkin_workflow_events_participant_idx" ON "consecutive_checkin_workflow_events" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consecutive_checkin_workflows_active_device_uidx" ON "consecutive_checkin_workflows" USING btree ("device_hash") WHERE "consecutive_checkin_workflows"."status" = 'active';--> statement-breakpoint
CREATE INDEX "consecutive_checkin_workflows_source_status_idx" ON "consecutive_checkin_workflows" USING btree ("source_event_id","status");--> statement-breakpoint
CREATE INDEX "consecutive_checkin_workflows_expiry_idx" ON "consecutive_checkin_workflows" USING btree ("status","hard_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_issue_events_issue_event_uidx" ON "ticket_issue_events" USING btree ("issue_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_issue_events_issue_order_uidx" ON "ticket_issue_events" USING btree ("issue_id","sort_order");--> statement-breakpoint
CREATE INDEX "ticket_issue_events_event_idx" ON "ticket_issue_events" USING btree ("event_id");
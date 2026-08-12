CREATE TYPE "public"."event_participation_mode" AS ENUM('onsite', 'preregistered');--> statement-breakpoint
CREATE TYPE "public"."participant_source" AS ENUM('onsite', 'preregistered');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'ticket_issue_created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'ticket_issue_claimed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'ticket_issue_replaced';--> statement-breakpoint
CREATE TABLE "ticket_issues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"token_nonce" text NOT NULL,
	"token_hash" text NOT NULL,
	"allocation" jsonb NOT NULL,
	"issued_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"invalidated_at" timestamp (3) with time zone,
	"consumed_at" timestamp (3) with time zone,
	"participant_id" uuid
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "participation_mode" "event_participation_mode" DEFAULT 'preregistered' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "participation_mode" SET DEFAULT 'onsite';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "max_tickets_per_issue" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "expected_lottery_tickets" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "next_issue_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "source" "participant_source" DEFAULT 'preregistered' NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "issue_number" integer;--> statement-breakpoint
ALTER TABLE "ticket_issues" ADD CONSTRAINT "ticket_issues_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_issues" ADD CONSTRAINT "ticket_issues_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_issues_token_hash_uidx" ON "ticket_issues" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ticket_issues_event_issued_idx" ON "ticket_issues" USING btree ("event_id","issued_at");--> statement-breakpoint
CREATE INDEX "ticket_issues_participant_idx" ON "ticket_issues" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_event_issue_number_uidx" ON "participants" USING btree ("event_id","issue_number") WHERE "participants"."issue_number" is not null;

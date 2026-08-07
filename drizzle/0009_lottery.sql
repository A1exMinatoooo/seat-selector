ALTER TYPE "public"."audit_action" ADD VALUE 'lottery_drawn';--> statement-breakpoint
CREATE TABLE "lottery_draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"draw_index" integer NOT NULL,
	"prize_id" uuid,
	"prize_name" text,
	"drawn_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lottery_prizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "lottery_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN "lottery_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lottery_draws" ADD CONSTRAINT "lottery_draws_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lottery_draws" ADD CONSTRAINT "lottery_draws_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lottery_draws" ADD CONSTRAINT "lottery_draws_prize_id_lottery_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."lottery_prizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lottery_prizes" ADD CONSTRAINT "lottery_prizes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lottery_draws_participant_index_uidx" ON "lottery_draws" USING btree ("participant_id","draw_index");--> statement-breakpoint
CREATE INDEX "lottery_draws_event_idx" ON "lottery_draws" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "lottery_draws_prize_idx" ON "lottery_draws" USING btree ("prize_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lottery_prizes_event_name_uidx" ON "lottery_prizes" USING btree ("event_id","name");
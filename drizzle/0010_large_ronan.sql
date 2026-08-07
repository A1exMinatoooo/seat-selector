CREATE TABLE "event_seats" (
	"event_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_seats_event_seat_uidx" ON "event_seats" USING btree ("event_id","seat_id");--> statement-breakpoint
CREATE INDEX "event_seats_event_idx" ON "event_seats" USING btree ("event_id");
--> statement-breakpoint
INSERT INTO "event_seats" ("event_id", "seat_id")
SELECT "events"."id", "seats"."id"
FROM "events"
INNER JOIN "seats" ON "seats"."hall_id" = "events"."hall_id"
WHERE "seats"."kind" = 'seat' AND "seats"."selectable" = true;

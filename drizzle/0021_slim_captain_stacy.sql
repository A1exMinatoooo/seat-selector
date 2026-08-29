CREATE TYPE "public"."event_seat_half" AS ENUM('left', 'right');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "locked_seat_half" "event_seat_half";
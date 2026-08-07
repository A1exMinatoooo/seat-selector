CREATE TYPE "public"."seat_kind" AS ENUM('seat', 'aisle', 'empty');--> statement-breakpoint
CREATE TABLE "cinemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cinemas_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "halls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cinema_id" uuid NOT NULL,
	"name" text NOT NULL,
	"center_after_column" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hall_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"column_index" integer NOT NULL,
	"row_label" text NOT NULL,
	"column_label" text NOT NULL,
	"kind" "seat_kind" DEFAULT 'seat' NOT NULL,
	"selectable" boolean DEFAULT true NOT NULL,
	"golden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "halls" ADD CONSTRAINT "halls_cinema_id_cinemas_id_fk" FOREIGN KEY ("cinema_id") REFERENCES "public"."cinemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_hall_id_halls_id_fk" FOREIGN KEY ("hall_id") REFERENCES "public"."halls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seats_hall_position_uidx" ON "seats" USING btree ("hall_id","row_index","column_index");
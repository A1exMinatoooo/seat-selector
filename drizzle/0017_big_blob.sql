CREATE TYPE "public"."audit_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'identity_tail_choice_required';--> statement-breakpoint
ALTER TABLE "event_audit_logs" ADD COLUMN "level" "audit_level" DEFAULT 'info' NOT NULL;
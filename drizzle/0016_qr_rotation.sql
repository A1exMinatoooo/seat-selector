ALTER TABLE "events" ADD COLUMN "qr_token_nonce" text;
ALTER TABLE "events" ADD COLUMN "qr_token_hash" text;
ALTER TABLE "events" ADD COLUMN "qr_token_issued_at" timestamp with time zone;
ALTER TABLE "events" ADD COLUMN "qr_token_expires_at" timestamp with time zone;

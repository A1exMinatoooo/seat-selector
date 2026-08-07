import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url(),
  APP_SECRET: z.string().min(32),
  ADMIN_PASSWORD_HASH: z.string().startsWith("scrypt$"),
  TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).default(0),
  DEFAULT_TIME_ZONE: z.string().default("Asia/Shanghai"),
});

let cached: z.infer<typeof envSchema> | undefined;

export function env() {
  cached ??= envSchema.parse(process.env);
  return cached;
}

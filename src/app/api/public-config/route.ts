import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { publicFilingConfigFromEnv } from "@/shared/public-filing-config";

export const dynamic = "force-dynamic";

export function GET() {
  const runtimeEnv = env();
  return NextResponse.json(publicFilingConfigFromEnv(runtimeEnv), {
    headers: { "cache-control": "no-store" },
  });
}

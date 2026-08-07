import { env } from "@/server/env";
import { DomainError, errorCodes } from "@/shared/errors";
export function clientAddress(request: Request): string { return env().TRUSTED_PROXY_COUNT > 0 ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" : "direct"; }
export function assertSameOrigin(request: Request): void { const origin = request.headers.get("origin"); if (origin && origin !== new URL(env().APP_URL).origin) throw new DomainError(errorCodes.forbidden, "Origin not allowed", 403); }
export function apiFailure(error: unknown): Response { if (error instanceof DomainError) return Response.json({ error: error.code }, { status: error.status }); console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : "Unknown error" })); return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 }); }

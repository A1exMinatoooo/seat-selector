import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { verifyQrToken } from "@/server/security/qr-token";
import { rateLimit } from "@/server/security/rate-limit";
import { apiFailure, assertSameOrigin, clientAddress } from "@/server/security/request";
import { setEntryClaim } from "@/server/security/participant-session";
import { DomainError, errorCodes } from "@/shared/errors";
const schema = z.object({ code: z.string().min(10).max(80), token: z.string().min(20).max(300) });
export async function POST(request: Request) { try { assertSameOrigin(request); if (!rateLimit(`redeem:${clientAddress(request)}`, 30, 60_000)) return Response.json({ error: "RATE_LIMITED" }, { status: 429 }); const input = schema.parse(await request.json()); const [event] = await getDb().select({ id: events.id, status: events.status }).from(events).where(eq(events.publicCode, input.code)).limit(1); if (!event || event.status !== "open" || !verifyQrToken(input.code, input.token)) throw new DomainError(errorCodes.forbidden, "QR invalid", 403); await setEntryClaim({ eventId: event.id, code: input.code }); return Response.json({ ok: true }); } catch (error) { return apiFailure(error); } }

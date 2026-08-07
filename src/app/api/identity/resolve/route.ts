import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveIdentity } from "@/features/entry/identity";
import { getDb } from "@/server/db/client";
import { events, participants } from "@/server/db/schema";
import { createIdentityClaim, getEntryClaim } from "@/server/security/participant-session";
import { rateLimit } from "@/server/security/rate-limit";
import { apiFailure, assertSameOrigin, clientAddress } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";
const schema = z.object({ code: z.string(), tail: z.string().regex(/^\d{4}$/), nameFirst: z.string().max(4).optional(), phonePrefix: z.string().regex(/^\d{3,11}$/).optional() });
export async function POST(request: Request) { try { assertSameOrigin(request); if (!rateLimit(`identity:${clientAddress(request)}`, 20, 60_000)) return Response.json({ error: "RATE_LIMITED" }, { status: 429 }); const input = schema.parse(await request.json()); const entry = await getEntryClaim(); const [event] = await getDb().select({ id: events.id }).from(events).where(and(eq(events.publicCode, input.code), eq(events.status, "open"))).limit(1); if (!entry || !event || entry.eventId !== event.id) throw new DomainError(errorCodes.forbidden, "Scan required", 403); const candidates = await getDb().select({ id: participants.id, nameFirst: participants.nameFirst, phoneDigits: participants.phoneDigits, phoneIsFull: participants.phoneIsFull }).from(participants).where(and(eq(participants.eventId, event.id), eq(participants.phoneLast4, input.tail))); if (!candidates.length) throw new DomainError(errorCodes.notFound, "No participant", 404); const result = resolveIdentity(candidates, input.nameFirst, input.phonePrefix); return Response.json(result.status === "resolved" ? { ...result, claim: createIdentityClaim({ eventId: event.id, participantId: result.participantId, code: input.code }) } : result); } catch (error) { return apiFailure(error); } }

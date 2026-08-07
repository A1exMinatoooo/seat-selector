import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { participants } from "@/server/db/schema";
import { randomToken, tokenHash } from "@/server/security/crypto";
import { setParticipantClaim, verifyIdentityClaim } from "@/server/security/participant-session";
import { apiFailure, assertSameOrigin } from "@/server/security/request";
import { DomainError, errorCodes } from "@/shared/errors";
export async function POST(request: Request) { try { assertSameOrigin(request); const { claim: token } = z.object({ claim: z.string().min(20) }).parse(await request.json()); const claim = verifyIdentityClaim(token); if (!claim) throw new DomainError(errorCodes.forbidden, "Identity expired", 403); const jar = await cookies(); const existingToken = jar.get("ps_device")?.value; const deviceToken = existingToken ?? randomToken(); const hash = tokenHash(deviceToken); const [person] = await getDb().select({ deviceHash: participants.deviceHash }).from(participants).where(and(eq(participants.id, claim.participantId), eq(participants.eventId, claim.eventId))).limit(1); if (!person) throw new DomainError(errorCodes.notFound, "Participant missing", 404); if (person.deviceHash && person.deviceHash !== hash) throw new DomainError(errorCodes.deviceBound, "Bound to another device", 409); if (!person.deviceHash) await getDb().update(participants).set({ deviceHash: hash, deviceBoundAt: new Date() }).where(eq(participants.id, claim.participantId)); if (!existingToken) jar.set("ps_device", deviceToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 180 * 24 * 60 * 60 }); await setParticipantClaim(claim); return Response.json({ ok: true }); } catch (error) { return apiFailure(error); } }

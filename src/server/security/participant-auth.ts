import "server-only";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { events, participants } from "@/server/db/schema";
import { tokenHash } from "./crypto";
import { getParticipantClaim } from "./participant-session";
import { DomainError, errorCodes } from "@/shared/errors";

export async function requireParticipantForEvent(code: string) {
  const claim = await getParticipantClaim();
  const device = (await cookies()).get("ps_device")?.value;
  if (!claim || claim.code !== code || !device) throw new DomainError(errorCodes.unauthorized, "Participant session required", 401);
  const [row] = await getDb().select({ eventId: events.id, hallId: events.hallId, status: events.status, version: events.version, participantId: participants.id, phoneLast4: participants.phoneLast4, ticketTotal: participants.ticketTotal, locationExemptAt: participants.locationExemptAt, deviceHash: participants.deviceHash }).from(events).innerJoin(participants, and(eq(participants.eventId, events.id), eq(participants.id, claim.participantId), eq(participants.deviceHash, tokenHash(device)))).where(eq(events.publicCode, code)).limit(1);
  if (!row) throw new DomainError(errorCodes.unauthorized, "Device binding invalid", 401);
  return row;
}

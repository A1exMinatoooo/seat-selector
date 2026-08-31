import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { events, participants, reservations } from "./schema";

const participantSelection = {
  eventId: events.id,
  hallId: events.hallId,
  status: events.status,
  version: events.version,
  locationCheckEnabled: events.locationCheckEnabled,
  participantId: participants.id,
  phoneLast4: participants.phoneLast4,
  ticketTotal: participants.ticketTotal,
  locationExemptAt: participants.locationExemptAt,
  deviceHash: participants.deviceHash,
};

export async function findClaimedParticipant(code: string, participantId: string, deviceHash: string) {
  const [row] = await getDb()
    .select(participantSelection)
    .from(events)
    .innerJoin(participants, and(eq(participants.eventId, events.id), eq(participants.id, participantId), eq(participants.deviceHash, deviceHash)))
    .where(eq(events.publicCode, code))
    .limit(1);
  return row ?? null;
}

export async function findOpenParticipantsByDevice(code: string, deviceHash: string) {
  return getDb()
    .select(participantSelection)
    .from(events)
    .innerJoin(participants, and(eq(participants.eventId, events.id), eq(participants.deviceHash, deviceHash)))
    .where(and(eq(events.publicCode, code), eq(events.status, "open")))
    .limit(2);
}

export async function hasCompletedReservationForDevice(code: string, deviceHash: string) {
  const [row] = await getDb()
    .select({ reservationId: reservations.id })
    .from(events)
    .innerJoin(
      participants,
      and(eq(participants.eventId, events.id), eq(participants.deviceHash, deviceHash)),
    )
    .innerJoin(
      reservations,
      and(
        eq(reservations.eventId, events.id),
        eq(reservations.participantId, participants.id),
      ),
    )
    .where(eq(events.publicCode, code))
    .limit(1);
  return Boolean(row);
}

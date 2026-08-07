"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseParticipantCsv, validateResolvable, type ParticipantImportRow } from "@/features/participants/import";
import { getDb } from "@/server/db/client";
import { events, participants, participantTickets, reservations, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";

async function eventTicketTypes(eventId: string) {
  return getDb().select({ id: ticketTypes.id, name: ticketTypes.name }).from(ticketTypes).where(eq(ticketTypes.eventId, eventId));
}

async function insertRows(eventId: string, rows: ParticipantImportRow[]) {
  const existing = await getDb().select({ name: participants.name, nameFirst: participants.nameFirst, phoneDigits: participants.phoneDigits, phoneLast4: participants.phoneLast4, phoneIsFull: participants.phoneIsFull, ticketTotal: participants.ticketTotal }).from(participants).where(eq(participants.eventId, eventId));
  validateResolvable([...existing.map((row) => ({ ...row, tickets: [] })), ...rows]);
  await getDb().transaction(async (tx) => {
    for (const row of rows) {
      const [created] = await tx.insert(participants).values({ eventId, name: row.name, nameFirst: row.nameFirst, phoneDigits: row.phoneDigits, phoneLast4: row.phoneLast4, phoneIsFull: row.phoneIsFull, ticketTotal: row.ticketTotal }).returning({ id: participants.id });
      if (!created) throw new Error("Participant creation did not return an id");
      await tx.insert(participantTickets).values(row.tickets.map((ticket) => ({ participantId: created.id, ...ticket })));
    }
  });
}

export async function importParticipantsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size > 2_000_000) throw new Error("请选择小于 2MB 的 CSV 文件");
  const [event] = await getDb().select({ status: events.status }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.status === "ended") throw new Error("活动不存在或已结束");
  const types = await eventTicketTypes(eventId);
  await insertRows(eventId, parseParticipantCsv(await file.text(), types));
  revalidatePath(`/admin/events/${eventId}/participants`);
}

export async function resetDeviceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId")); const participantId = String(formData.get("participantId"));
  await getDb().update(participants).set({ deviceHash: null, deviceBoundAt: null }).where(and(eq(participants.id, participantId), eq(participants.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}/participants`);
}

export async function toggleLocationExemptionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId")); const participantId = String(formData.get("participantId")); const enabled = formData.get("enabled") === "1";
  await getDb().update(participants).set({ locationExemptAt: enabled ? new Date() : null }).where(and(eq(participants.id, participantId), eq(participants.eventId, eventId)));
  revalidatePath(`/admin/events/${eventId}/participants`);
}

export async function resetSelectionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId")); const participantId = String(formData.get("participantId"));
  await getDb().transaction(async (tx) => {
    await tx.delete(reservations).where(and(eq(reservations.eventId, eventId), eq(reservations.participantId, participantId)));
    await tx.update(events).set({ version: sql`${events.version} + 1` }).where(eq(events.id, eventId));
  });
  revalidatePath(`/admin/events/${eventId}/participants`);
}

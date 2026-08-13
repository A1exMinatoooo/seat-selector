"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseParticipantCsv, parseParticipantInput, validateResolvable, type ParticipantImportRow } from "@/features/participants/import";
import { getDb } from "@/server/db/client";
import { eventAuditLogs, events, participants, participantTickets, reservations, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";

async function eventTicketTypes(eventId: string) {
  return getDb().select({ id: ticketTypes.id, name: ticketTypes.name, lotteryEligible: ticketTypes.lotteryEligible }).from(ticketTypes).where(eq(ticketTypes.eventId, eventId));
}

async function insertRows(eventId: string, rows: ParticipantImportRow[], source: "csv" | "manual") {
  const existing = await getDb().select({ nickname: participants.nickname, nicknameFirst: participants.nicknameFirst, phoneDigits: participants.phoneDigits, phoneLast4: participants.phoneLast4, phoneIsFull: participants.phoneIsFull, ticketTotal: participants.ticketTotal }).from(participants).where(eq(participants.eventId, eventId));
  validateResolvable([...existing.map((row) => ({ ...row, tickets: [] })), ...rows]);
  await getDb().transaction(async (tx) => {
    for (const row of rows) {
      const [created] = await tx.insert(participants).values({ eventId, nickname: row.nickname, nicknameFirst: row.nicknameFirst, phoneDigits: row.phoneDigits, phoneLast4: row.phoneLast4, phoneIsFull: row.phoneIsFull, ticketTotal: row.ticketTotal }).returning({ id: participants.id });
      if (!created) throw new Error("Participant creation did not return an id");
      await tx.insert(participantTickets).values(row.tickets.map((ticket) => ({ participantId: created.id, ...ticket })));
      if (source === "manual") await tx.insert(eventAuditLogs).values({ eventId, participantId: created.id, action: "participant_added", details: { ticketTotal: row.ticketTotal } });
    }
    if (source === "csv") await tx.insert(eventAuditLogs).values({ eventId, action: "participants_imported", details: { count: rows.length, ticketTotal: rows.reduce((sum, row) => sum + row.ticketTotal, 0) } });
  });
}

export async function importParticipantsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size > 2_000_000) throw new Error("请选择小于 2MB 的 CSV 文件");
  const [event] = await getDb().select({ status: events.status, participationMode: events.participationMode }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.status === "ended" || event.participationMode === "onsite") throw new Error("活动不存在、已结束或不允许预录参与者");
  const types = await eventTicketTypes(eventId);
  await insertRows(eventId, parseParticipantCsv(await file.text(), types), "csv");
  revalidatePath(`/admin/events/${eventId}/participants`);
}

export async function addParticipantAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const [event] = await getDb().select({ status: events.status, participationMode: events.participationMode }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.status === "ended" || event.participationMode === "onsite") throw new Error("活动不存在、已结束或不允许预录参与者");
  const types = await eventTicketTypes(eventId);
  const quantities = Object.fromEntries(types.map((type) => [type.id, formData.get(`ticket:${type.id}`)]));
  const row = parseParticipantInput({ nickname: formData.get("nickname"), phone: formData.get("phone"), quantities }, types);
  await insertRows(eventId, [row], "manual");
  revalidatePath(`/admin/events/${eventId}/participants`);
}

export async function resetDeviceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId")); const participantId = String(formData.get("participantId"));
  await getDb().transaction(async (tx) => {
    const [updated] = await tx.update(participants).set({ deviceHash: null, deviceBoundAt: null }).where(and(eq(participants.id, participantId), eq(participants.eventId, eventId))).returning({ id: participants.id });
    if (updated) await tx.insert(eventAuditLogs).values({ eventId, participantId, action: "device_reset" });
  });
  revalidatePath(`/admin/events/${eventId}/participants`);
}

export async function toggleLocationExemptionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId")); const participantId = String(formData.get("participantId")); const enabled = formData.get("enabled") === "1";
  await getDb().transaction(async (tx) => {
    const [updated] = await tx.update(participants).set({ locationExemptAt: enabled ? new Date() : null }).where(and(eq(participants.id, participantId), eq(participants.eventId, eventId))).returning({ id: participants.id });
    if (updated) await tx.insert(eventAuditLogs).values({ eventId, participantId, action: "location_exemption_changed", details: { enabled } });
  });
  revalidatePath(`/admin/events/${eventId}/participants`);
}

export async function resetSelectionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const eventId = String(formData.get("eventId")); const participantId = String(formData.get("participantId"));
  await getDb().transaction(async (tx) => {
    const [deleted] = await tx.delete(reservations).where(and(eq(reservations.eventId, eventId), eq(reservations.participantId, participantId))).returning({ id: reservations.id });
    if (deleted) {
      await tx.update(events).set({ version: sql`${events.version} + 1` }).where(eq(events.id, eventId));
      await tx.insert(eventAuditLogs).values({ eventId, participantId, action: "selection_reset", details: { reservationId: deleted.id } });
    }
  });
  revalidatePath(`/admin/events/${eventId}/participants`);
}

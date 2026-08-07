"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eventInputSchema } from "@/features/events/schemas";
import { getDb } from "@/server/db/client";
import { eventAuditLogs, events, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { randomToken } from "@/server/security/crypto";

export async function createEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const rawTypes = formData.get("ticketTypes");
  const ticketNames = typeof rawTypes === "string" ? JSON.parse(rawTypes) as unknown : [];
  const input = eventInputSchema.parse({ ...Object.fromEntries(formData), ticketTypes: ticketNames });
  const eventId = await getDb().transaction(async (tx) => {
    const [created] = await tx.insert(events).values({
      publicCode: randomToken(18), name: input.name, hallId: input.hallId, locationId: input.locationId,
      radiusMeters: input.radiusMeters, startsAt: input.startsAt, timeZone: input.timeZone,
    }).returning({ id: events.id });
    if (!created) throw new Error("Event creation did not return an id");
    await tx.insert(ticketTypes).values(input.ticketTypes.map((name, sortOrder) => ({ eventId: created.id, name, sortOrder })));
    await tx.insert(eventAuditLogs).values({ eventId: created.id, action: "event_created", details: { ticketTypeCount: input.ticketTypes.length } });
    return created.id;
  });
  redirect(`/admin/events/${eventId}`);
}

export async function setEventStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if ((status !== "open" && status !== "ended") || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid event status change");
  await getDb().transaction(async (tx) => {
    const [event] = await tx.select({ status: events.status }).from(events).where(eq(events.id, id)).limit(1);
    if (!event) throw new Error("Event not found");
    await tx.update(events).set({ status, version: sql`${events.version} + 1` }).where(eq(events.id, id));
    await tx.insert(eventAuditLogs).values({ eventId: id, action: "event_status_changed", details: { from: event.status, to: status } });
  });
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
}

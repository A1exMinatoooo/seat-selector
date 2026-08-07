"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eventInputSchema } from "@/features/events/schemas";
import { getDb } from "@/server/db/client";
import { eventAuditLogs, events, lotteryPrizes, participantTickets, ticketTypes } from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";
import { randomToken } from "@/server/security/crypto";

export async function createEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const rawTypes = formData.get("ticketTypes");
  const rawPrizes = formData.get("prizes");
  const parsedTypes = typeof rawTypes === "string" ? JSON.parse(rawTypes) as unknown : [];
  const parsedPrizes = typeof rawPrizes === "string" ? JSON.parse(rawPrizes) as unknown : [];
  const input = eventInputSchema.parse({ ...Object.fromEntries(formData), ticketTypes: parsedTypes, prizes: parsedPrizes });
  const eventId = await getDb().transaction(async (tx) => {
    const [created] = await tx.insert(events).values({
      publicCode: randomToken(18), name: input.name, hallId: input.hallId, locationId: input.locationId,
      radiusMeters: input.radiusMeters, startsAt: input.startsAt, timeZone: input.timeZone, lotteryEnabled: input.lotteryEnabled,
    }).returning({ id: events.id });
    if (!created) throw new Error("Event creation did not return an id");
    await tx.insert(ticketTypes).values(input.ticketTypes.map((type, sortOrder) => ({ eventId: created.id, ...type, sortOrder })));
    if (input.lotteryEnabled) await tx.insert(lotteryPrizes).values(input.prizes.map((prize, sortOrder) => ({ eventId: created.id, ...prize, sortOrder })));
    await tx.insert(eventAuditLogs).values({ eventId: created.id, action: "event_created", details: { ticketTypeCount: input.ticketTypes.length, lotteryEnabled: input.lotteryEnabled, prizeCount: input.prizes.length } });
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
    const [event] = await tx.select({ status: events.status, lotteryEnabled: events.lotteryEnabled }).from(events).where(eq(events.id, id)).limit(1);
    if (!event) throw new Error("Event not found");
    if (status === "open" && event.lotteryEnabled) {
      const [eligiblePool, inventory] = await Promise.all([
        tx.select({ total: sql<number>`coalesce(sum(${participantTickets.quantity}), 0)::int` }).from(participantTickets).innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id)).where(and(eq(ticketTypes.eventId, id), eq(ticketTypes.lotteryEligible, true))),
        tx.select({ total: sql<number>`coalesce(sum(${lotteryPrizes.quantity}), 0)::int` }).from(lotteryPrizes).where(eq(lotteryPrizes.eventId, id)),
      ]);
      if (Number(eligiblePool[0]?.total ?? 0) < Number(inventory[0]?.total ?? 0)) throw new Error("参与抽奖的票数少于奖品总数，请先补充参与者或调整活动奖品");
    }
    await tx.update(events).set({ status, version: sql`${events.version} + 1` }).where(eq(events.id, id));
    await tx.insert(eventAuditLogs).values({ eventId: id, action: "event_status_changed", details: { from: event.status, to: status } });
  });
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
}

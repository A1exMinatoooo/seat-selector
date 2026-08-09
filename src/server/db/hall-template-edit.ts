import "server-only";

import { eq } from "drizzle-orm";
import type { EditableHallLayout } from "@/features/venues/seat-layout-editor";
import { getDb } from "./client";
import { events, halls, seats } from "./schema";
import { canEditHallTemplate } from "@/server/domain/hall-template-edit";

export class HallTemplateInUseError extends Error {
  readonly code = "HALL_TEMPLATE_IN_USE";
}

export async function replaceHallTemplate(input: { id: string; name: string; layout: EditableHallLayout }): Promise<string> {
  return getDb().transaction(async (tx) => {
    const [hall] = await tx.select({ cinemaId: halls.cinemaId, archivedAt: halls.archivedAt }).from(halls).where(eq(halls.id, input.id)).limit(1).for("update");
    if (!hall || hall.archivedAt) throw new Error("Hall template not found");
    const statuses = await tx.select({ status: events.status }).from(events).where(eq(events.hallId, input.id));
    if (!canEditHallTemplate(statuses.map((event) => event.status))) throw new HallTemplateInUseError("Hall template has unfinished events");
    const [replacement] = await tx.insert(halls).values({ cinemaId: hall.cinemaId, name: input.name, centerAfterColumn: input.layout.centerAfterColumn }).returning({ id: halls.id });
    if (!replacement) throw new Error("Hall replacement did not return an id");
    await tx.insert(seats).values(input.layout.cells.map((cell) => ({ hallId: replacement.id, ...cell })));
    await tx.update(halls).set({ archivedAt: new Date() }).where(eq(halls.id, input.id));
    return replacement.id;
  });
}

export async function archiveHallTemplate(id: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [hall] = await tx.select({ id: halls.id, archivedAt: halls.archivedAt }).from(halls).where(eq(halls.id, id)).limit(1).for("update");
    if (!hall || hall.archivedAt) return false;
    const linkedEvents = await tx.select({ id: events.id }).from(events).where(eq(events.hallId, id));
    if (linkedEvents.length > 0) throw new HallTemplateInUseError("Hall template has associated events");
    await tx.update(halls).set({ archivedAt: new Date() }).where(eq(halls.id, id));
    return true;
  });
}

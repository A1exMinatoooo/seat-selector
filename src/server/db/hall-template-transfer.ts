import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import type { HallTemplateBundle } from "@/server/domain/hall-template-transfer";
import { getDb } from "./client";
import { cinemas, halls, seats } from "./schema";

export type HallTemplateExportScope = { type: "all" } | { type: "cinema"; id: string } | { type: "hall"; id: string };

export async function exportHallTemplates(scope: HallTemplateExportScope): Promise<HallTemplateBundle | null> {
  const cinemaCondition = scope.type === "cinema" ? eq(cinemas.id, scope.id) : undefined;
  const hallCondition = scope.type === "hall" ? eq(halls.id, scope.id) : undefined;
  const cinemaRows = scope.type === "hall"
    ? await getDb().selectDistinct({ id: cinemas.id, name: cinemas.name }).from(cinemas).innerJoin(halls, eq(halls.cinemaId, cinemas.id)).where(hallCondition).orderBy(asc(cinemas.name))
    : await getDb().select({ id: cinemas.id, name: cinemas.name }).from(cinemas).where(cinemaCondition).orderBy(asc(cinemas.name));
  if (!cinemaRows.length) return null;

  const hallRows = await getDb().select({ id: halls.id, cinemaId: halls.cinemaId, name: halls.name, centerAfterColumn: halls.centerAfterColumn }).from(halls).where(scope.type === "hall" ? hallCondition : inArray(halls.cinemaId, cinemaRows.map((cinema) => cinema.id))).orderBy(asc(halls.createdAt));
  if (!hallRows.length) return null;
  const seatRows = await getDb().select({ hallId: seats.hallId, rowIndex: seats.rowIndex, columnIndex: seats.columnIndex, rowLabel: seats.rowLabel, columnLabel: seats.columnLabel, kind: seats.kind, selectable: seats.selectable, golden: seats.golden }).from(seats).where(inArray(seats.hallId, hallRows.map((hall) => hall.id))).orderBy(asc(seats.rowIndex), asc(seats.columnIndex));

  return {
    format: "pick-your-seat/hall-templates",
    version: 1,
    exportedAt: new Date().toISOString(),
    cinemas: cinemaRows.flatMap((cinema) => {
      const cinemaHalls = hallRows.filter((hall) => hall.cinemaId === cinema.id).map((hall) => {
        const cells = seatRows.filter((seat) => seat.hallId === hall.id).map((seat) => ({ rowIndex: seat.rowIndex, columnIndex: seat.columnIndex, rowLabel: seat.rowLabel, columnLabel: seat.columnLabel, kind: seat.kind, selectable: seat.selectable, golden: seat.golden }));
        return { name: hall.name, layout: { rows: Math.max(...cells.map((cell) => cell.rowIndex), 0) + 1, columns: Math.max(...cells.map((cell) => cell.columnIndex), 0) + 1, centerAfterColumn: hall.centerAfterColumn, cells } };
      });
      return cinemaHalls.length ? [{ name: cinema.name, halls: cinemaHalls }] : [];
    }),
  };
}

export async function importHallTemplates(bundle: HallTemplateBundle): Promise<{ cinemas: number; halls: number }> {
  return getDb().transaction(async (tx) => {
    let importedCinemas = 0;
    let importedHalls = 0;
    for (const cinemaTemplate of bundle.cinemas) {
      let [cinema] = await tx.select({ id: cinemas.id }).from(cinemas).where(eq(cinemas.name, cinemaTemplate.name)).limit(1);
      if (!cinema) {
        [cinema] = await tx.insert(cinemas).values({ name: cinemaTemplate.name }).returning({ id: cinemas.id });
        importedCinemas += 1;
      }
      if (!cinema) throw new Error("Cinema import did not return an id");
      for (const hallTemplate of cinemaTemplate.halls) {
        const [hall] = await tx.insert(halls).values({ cinemaId: cinema.id, name: hallTemplate.name, centerAfterColumn: hallTemplate.layout.centerAfterColumn }).returning({ id: halls.id });
        if (!hall) throw new Error("Hall import did not return an id");
        await tx.insert(seats).values(hallTemplate.layout.cells.map((cell) => ({ hallId: hall.id, ...cell })));
        importedHalls += 1;
      }
    }
    return { cinemas: importedCinemas, halls: importedHalls };
  });
}

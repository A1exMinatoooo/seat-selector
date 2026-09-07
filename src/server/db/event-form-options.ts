import "server-only";

import { asc, eq, isNull } from "drizzle-orm";
import { getDb } from "./client";
import { cinemas, halls, locationPresets, seats } from "./schema";

export async function getEventFormOptions() {
  const [hallRows, locations, seatRows] = await Promise.all([
    getDb()
      .select({
        id: halls.id,
        hallName: halls.name,
        centerAfterColumn: halls.centerAfterColumn,
        cinemaId: cinemas.id,
        cinemaName: cinemas.name,
      })
      .from(halls)
      .innerJoin(cinemas, eq(halls.cinemaId, cinemas.id))
      .where(isNull(halls.archivedAt))
      .orderBy(asc(cinemas.name), asc(halls.name)),
    getDb().select().from(locationPresets).orderBy(asc(locationPresets.name)),
    getDb().select().from(seats).orderBy(asc(seats.rowIndex), asc(seats.columnIndex)),
  ]);
  const layouts = hallRows.map((hall) => ({
    id: hall.id,
    cinemaId: hall.cinemaId,
    cinemaName: hall.cinemaName,
    hallName: hall.hallName,
    centerAfterColumn: hall.centerAfterColumn,
    seats: seatRows.filter((seat) => seat.hallId === hall.id),
  }));
  return { hallRows, locations, layouts };
}

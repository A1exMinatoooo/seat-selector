import { asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  events,
  participants,
  participantTickets,
  reservations,
  reservationSeats,
  seats,
  ticketTypes,
} from "@/server/db/schema";
import { hasAdminSession } from "@/server/security/admin-session";
import { formatSeatLabel } from "@/shared/seat-label";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminSession())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const [event] = await getDb()
    .select({ name: events.name, participationMode: events.participationMode })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!event) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const [people, types, allocations, reservationsRows, seatRows] = await Promise.all([
    getDb()
      .select()
      .from(participants)
      .where(eq(participants.eventId, id))
      .orderBy(asc(participants.createdAt)),
    getDb()
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, id))
      .orderBy(asc(ticketTypes.sortOrder)),
    getDb()
      .select()
      .from(participantTickets)
      .innerJoin(ticketTypes, eq(participantTickets.ticketTypeId, ticketTypes.id))
      .where(eq(ticketTypes.eventId, id)),
    getDb().select().from(reservations).where(eq(reservations.eventId, id)),
    getDb()
      .select({
        participantId: reservations.participantId,
        rowLabel: seats.rowLabel,
        columnLabel: seats.columnLabel,
      })
      .from(reservationSeats)
      .innerJoin(reservations, eq(reservationSeats.reservationId, reservations.id))
      .innerJoin(seats, eq(reservationSeats.seatId, seats.id))
      .where(eq(reservationSeats.eventId, id)),
  ]);
  const allocationMap = new Map(
    allocations.map((row) => [
      `${row.participant_tickets.participantId}:${row.ticket_types.id}`,
      row.participant_tickets.quantity,
    ]),
  );
  const reservationMap = new Map(reservationsRows.map((row) => [row.participantId, row]));
  const seatMap = Map.groupBy(seatRows, (row) => row.participantId);
  const identityHeaders = event.participationMode === "onsite" ? ["编号"] : ["昵称", "手机号"];
  const header = [
    ...identityHeaders,
    ...types.map((type) => type.name),
    "总张数",
    "所选座位",
    "确认时间",
  ];
  const lines = [
    header,
    ...people.map((person) => [
      person.nickname,
      ...(event.participationMode === "preregistered" ? [person.phoneIsFull
        ? `${person.phoneDigits.slice(0, 3)}****${person.phoneLast4}`
        : `****${person.phoneLast4}`] : []),
      ...types.map((type) => allocationMap.get(`${person.id}:${type.id}`) ?? 0),
      person.ticketTotal,
      (seatMap.get(person.id) ?? [])
        .map((seat) => formatSeatLabel(seat.rowLabel, seat.columnLabel))
        .join("、"),
      reservationMap.get(person.id)?.confirmedAt.toISOString() ?? "",
    ]),
  ].map((row) => row.map(csvCell).join(","));
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(event.name)}.csv`,
    },
  });
}

export type SeatPosition = {
  id: string;
  kind: "seat" | "aisle" | "empty";
  templateSelectable: boolean;
};

export type PositionedSeat = SeatPosition & { columnIndex: number };

export function resolveEventAvailability(
  seats: SeatPosition[],
  requestedSeatIds: Iterable<string>,
  reservedSeatIds: Iterable<string> = [],
): string[] {
  const validSeatIds = new Set(
    seats.filter((seat) => seat.kind === "seat" && seat.templateSelectable).map((seat) => seat.id),
  );
  const requested = new Set(requestedSeatIds);
  const reserved = new Set(reservedSeatIds);

  return seats
    .filter((seat) => validSeatIds.has(seat.id) && (requested.has(seat.id) || reserved.has(seat.id)))
    .map((seat) => seat.id);
}

export function lockSeatHalf(
  seats: PositionedSeat[],
  currentAvailableSeatIds: Iterable<string>,
  reservedSeatIds: Iterable<string>,
  side: "left" | "right",
  centerAfterColumn: number | null,
): string[] {
  if (seats.length === 0) return [];
  const columns = seats.map((seat) => seat.columnIndex);
  const boundary = centerAfterColumn ?? Math.floor((Math.min(...columns) + Math.max(...columns)) / 2);
  const current = new Set(currentAvailableSeatIds);
  const remaining = seats
    .filter((seat) => current.has(seat.id))
    .filter((seat) => side === "left" ? seat.columnIndex > boundary : seat.columnIndex <= boundary)
    .map((seat) => seat.id);
  return resolveEventAvailability(seats, remaining, reservedSeatIds);
}

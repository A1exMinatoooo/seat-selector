export type SeatPosition = {
  id: string;
  kind: "seat" | "aisle" | "empty";
  templateSelectable: boolean;
};

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

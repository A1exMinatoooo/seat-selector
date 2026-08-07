export type SeatPosition = {
  id: string;
  kind: "seat" | "aisle" | "empty";
  templateSelectable: boolean;
};

export type PositionedSeat = SeatPosition & { columnIndex: number };
export type SeatHalf = "left" | "right";

function halfBoundary(seats: PositionedSeat[], centerAfterColumn: number | null): number {
  const columns = seats.map((seat) => seat.columnIndex);
  return centerAfterColumn ?? Math.floor((Math.min(...columns) + Math.max(...columns)) / 2);
}

function isInHalf(seat: PositionedSeat, side: SeatHalf, boundary: number): boolean {
  return side === "left" ? seat.columnIndex <= boundary : seat.columnIndex > boundary;
}

export function describeAvailabilityChange(
  beforeSeatIds: Iterable<string>,
  afterSeatIds: Iterable<string>,
): { beforeCount: number; afterCount: number; addedCount: number; removedCount: number } {
  const before = new Set(beforeSeatIds);
  const after = new Set(afterSeatIds);
  return {
    beforeCount: before.size,
    afterCount: after.size,
    addedCount: [...after].filter((seatId) => !before.has(seatId)).length,
    removedCount: [...before].filter((seatId) => !after.has(seatId)).length,
  };
}

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

export function detectLockedSeatHalf(
  seats: PositionedSeat[],
  currentAvailableSeatIds: Iterable<string>,
  reservedSeatIds: Iterable<string>,
  centerAfterColumn: number | null,
): SeatHalf | null {
  if (seats.length === 0) return null;
  const boundary = halfBoundary(seats, centerAfterColumn);
  const available = new Set(currentAvailableSeatIds);
  const reserved = new Set(reservedSeatIds);
  const isLocked = (side: SeatHalf) => {
    const eligible = seats.filter((seat) => seat.kind === "seat" && seat.templateSelectable && !reserved.has(seat.id) && isInHalf(seat, side, boundary));
    return eligible.length > 0 && eligible.every((seat) => !available.has(seat.id));
  };
  const leftLocked = isLocked("left");
  const rightLocked = isLocked("right");
  return leftLocked === rightLocked ? null : leftLocked ? "left" : "right";
}

export function toggleSeatHalfLock(
  seats: PositionedSeat[],
  currentAvailableSeatIds: Iterable<string>,
  reservedSeatIds: Iterable<string>,
  side: SeatHalf,
  centerAfterColumn: number | null,
): { availableSeatIds: string[]; previousSide: SeatHalf | null; activeSide: SeatHalf | null; operation: "lock" | "unlock" | "switch" } {
  if (seats.length === 0) return { availableSeatIds: [], previousSide: null, activeSide: null, operation: "lock" };
  const current = new Set(currentAvailableSeatIds);
  const reserved = new Set(reservedSeatIds);
  const previousSide = detectLockedSeatHalf(seats, current, reserved, centerAfterColumn);
  const boundary = halfBoundary(seats, centerAfterColumn);
  const activeSide = previousSide === side ? null : side;

  for (const seat of seats) {
    if (seat.kind !== "seat" || !seat.templateSelectable) continue;
    if (activeSide === null) {
      if (isInHalf(seat, side, boundary)) current.add(seat.id);
    } else if (!isInHalf(seat, activeSide, boundary)) current.add(seat.id);
    else if (!reserved.has(seat.id)) current.delete(seat.id);
  }

  return {
    availableSeatIds: resolveEventAvailability(seats, current, reserved),
    previousSide,
    activeSide,
    operation: activeSide === null ? "unlock" : previousSide === null ? "lock" : "switch",
  };
}

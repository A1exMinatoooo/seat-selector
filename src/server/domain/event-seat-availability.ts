export type SeatPosition = {
  id: string;
  kind: "seat" | "aisle" | "empty";
  templateSelectable: boolean;
};

export type PositionedSeat = SeatPosition & { columnIndex: number };
export type GridPositionedSeat = PositionedSeat & { rowIndex: number };
export type SeatHalf = "left" | "right";

export function toggleSelectedSeatAvailability(
  availableSeatIds: ReadonlySet<string>,
  selectedSeatIds: Iterable<string>,
  lockedSeatIds: ReadonlySet<string> = new Set(),
): Set<string> {
  const next = new Set(availableSeatIds);
  for (const seatId of selectedSeatIds) {
    if (lockedSeatIds.has(seatId)) continue;
    if (next.has(seatId)) next.delete(seatId);
    else next.add(seatId);
  }
  for (const seatId of lockedSeatIds) next.add(seatId);
  return next;
}

export type QuickOpenResult = {
  availableSeatIds: string[];
  width: number;
  height: number;
};

function centeredColumnStart(
  width: number,
  center: number,
  minColumn: number,
  maxColumn: number,
): number {
  const maximumStart = maxColumn - width + 1;
  return Math.min(maximumStart, Math.max(minColumn, Math.ceil(center - width / 2)));
}

export function quickOpenSeatRectangle(
  seats: GridPositionedSeat[],
  count: number,
  centerAfterColumn: number | null,
): QuickOpenResult {
  const eligible = seats.filter((seat) => seat.kind === "seat" && seat.templateSelectable);
  if (!Number.isInteger(count) || count < 1 || count > eligible.length) {
    throw new RangeError("Requested seat count exceeds the selectable template capacity");
  }

  const minColumn = Math.min(...seats.map((seat) => seat.columnIndex));
  const maxColumn = Math.max(...seats.map((seat) => seat.columnIndex));
  const minRow = Math.min(...seats.map((seat) => seat.rowIndex));
  const bottomRow = Math.max(...eligible.map((seat) => seat.rowIndex));
  const columnSpan = maxColumn - minColumn + 1;
  const rowSpan = bottomRow - minRow + 1;
  const center = centerAfterColumn === null ? (minColumn + maxColumn) / 2 : centerAfterColumn + 0.5;
  let best: {
    seats: GridPositionedSeat[];
    width: number;
    height: number;
    score: number;
    area: number;
  } | null = null;

  for (let height = 1; height <= rowSpan; height += 1) {
    const topRow = bottomRow - height + 1;
    for (let width = 1; width <= columnSpan; width += 1) {
      if (width * height < count) continue;
      const leftColumn = centeredColumnStart(width, center, minColumn, maxColumn);
      const candidates = eligible.filter(
        (seat) =>
          seat.rowIndex >= topRow &&
          seat.rowIndex <= bottomRow &&
          seat.columnIndex >= leftColumn &&
          seat.columnIndex < leftColumn + width,
      );
      if (candidates.length < count) continue;
      const area = width * height;
      const score = Math.abs(width / height - 4 / 3) + (area - count) / count;
      if (!best || score < best.score || (score === best.score && area < best.area)) {
        best = { seats: candidates, width, height, score, area };
      }
    }
  }

  if (!best) throw new RangeError("Could not fit the requested seats in the hall layout");
  const ordered = best.seats.toSorted(
    (left, right) =>
      right.rowIndex - left.rowIndex ||
      Math.abs(left.columnIndex - center) - Math.abs(right.columnIndex - center) ||
      left.columnIndex - right.columnIndex,
  );
  return {
    availableSeatIds: ordered.slice(0, count).map((seat) => seat.id),
    width: best.width,
    height: best.height,
  };
}

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
    .filter(
      (seat) => validSeatIds.has(seat.id) && (requested.has(seat.id) || reserved.has(seat.id)),
    )
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
    const eligible = seats.filter(
      (seat) =>
        seat.kind === "seat" &&
        seat.templateSelectable &&
        !reserved.has(seat.id) &&
        isInHalf(seat, side, boundary),
    );
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
): {
  availableSeatIds: string[];
  previousSide: SeatHalf | null;
  activeSide: SeatHalf | null;
  operation: "lock" | "unlock" | "switch";
} {
  if (seats.length === 0)
    return { availableSeatIds: [], previousSide: null, activeSide: null, operation: "lock" };
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

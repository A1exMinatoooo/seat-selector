export const TOUCH_DRAG_THRESHOLD = 6;

export type TouchPaintGesture =
  | { mode: "idle" }
  | {
      mode: "single";
      pointerId: number;
      startX: number;
      startY: number;
      startSeatId: string | null;
      painting: boolean;
    }
  | { mode: "multiple"; pointerIds: number[] };

export type TouchPaintAction = "none" | "begin" | "continue" | "tap" | "end" | "cancel";

export function beginTouchPaintGesture(
  gesture: TouchPaintGesture,
  pointerId: number,
  clientX: number,
  clientY: number,
  seatId: string | null,
): { gesture: TouchPaintGesture; action: TouchPaintAction } {
  if (gesture.mode === "idle") {
    return {
      gesture: {
        mode: "single",
        pointerId,
        startX: clientX,
        startY: clientY,
        startSeatId: seatId,
        painting: false,
      },
      action: "none",
    };
  }

  if (gesture.mode === "single") {
    return {
      gesture: { mode: "multiple", pointerIds: [gesture.pointerId, pointerId] },
      action: "cancel",
    };
  }

  return {
    gesture: gesture.pointerIds.includes(pointerId)
      ? gesture
      : { mode: "multiple", pointerIds: [...gesture.pointerIds, pointerId] },
    action: "none",
  };
}

export function moveTouchPaintGesture(
  gesture: TouchPaintGesture,
  pointerId: number,
  clientX: number,
  clientY: number,
): { gesture: TouchPaintGesture; action: TouchPaintAction } {
  if (gesture.mode !== "single" || gesture.pointerId !== pointerId)
    return { gesture, action: "none" };
  if (gesture.painting) return { gesture, action: "continue" };
  if (
    !gesture.startSeatId ||
    Math.hypot(clientX - gesture.startX, clientY - gesture.startY) < TOUCH_DRAG_THRESHOLD
  ) {
    return { gesture, action: "none" };
  }
  return { gesture: { ...gesture, painting: true }, action: "begin" };
}

export function endTouchPaintGesture(
  gesture: TouchPaintGesture,
  pointerId: number,
): { gesture: TouchPaintGesture; action: TouchPaintAction } {
  if (gesture.mode === "single") {
    if (gesture.pointerId !== pointerId) return { gesture, action: "none" };
    return {
      gesture: { mode: "idle" },
      action: gesture.painting ? "end" : gesture.startSeatId ? "tap" : "none",
    };
  }
  if (gesture.mode === "multiple") {
    const pointerIds = gesture.pointerIds.filter((id) => id !== pointerId);
    return {
      gesture: pointerIds.length ? { mode: "multiple", pointerIds } : { mode: "idle" },
      action: "none",
    };
  }
  return { gesture, action: "none" };
}

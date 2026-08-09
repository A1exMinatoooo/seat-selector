import { describe, expect, it } from "vitest";
import {
  beginTouchPaintGesture,
  endTouchPaintGesture,
  moveTouchPaintGesture,
  type TouchPaintGesture,
} from "@/features/events/event-seat-pointer-gesture";

describe("event seat touch gestures", () => {
  it("waits until a single-finger tap ends before toggling a seat", () => {
    const started = beginTouchPaintGesture({ mode: "idle" }, 1, 10, 10, "A1");
    expect(started.action).toBe("none");
    expect(endTouchPaintGesture(started.gesture, 1)).toEqual({
      gesture: { mode: "idle" },
      action: "tap",
    });
  });

  it("starts painting only after one finger crosses the drag threshold", () => {
    const started = beginTouchPaintGesture({ mode: "idle" }, 1, 10, 10, "A1");
    expect(moveTouchPaintGesture(started.gesture, 1, 13, 14).action).toBe("none");
    const dragging = moveTouchPaintGesture(started.gesture, 1, 16, 10);
    expect(dragging.action).toBe("begin");
    expect(moveTouchPaintGesture(dragging.gesture, 1, 20, 10).action).toBe("continue");
  });

  it("cancels seat painting when a second finger starts and stays isolated until every finger lifts", () => {
    const first = beginTouchPaintGesture({ mode: "idle" }, 1, 10, 10, "A1");
    const dragging = moveTouchPaintGesture(first.gesture, 1, 20, 10);
    const pinching = beginTouchPaintGesture(dragging.gesture, 2, 30, 10, "A2");
    expect(pinching.action).toBe("cancel");
    expect(moveTouchPaintGesture(pinching.gesture, 1, 40, 10).action).toBe("none");

    const oneFingerLeft = endTouchPaintGesture(pinching.gesture, 2);
    expect(oneFingerLeft.gesture).toEqual({ mode: "multiple", pointerIds: [1] });
    expect(endTouchPaintGesture(oneFingerLeft.gesture, 1)).toEqual({
      gesture: { mode: "idle" },
      action: "none",
    });
  });

  it("ignores movement from an unrelated pointer", () => {
    const gesture: TouchPaintGesture = {
      mode: "single",
      pointerId: 1,
      startX: 0,
      startY: 0,
      startSeatId: "A1",
      painting: false,
    };
    expect(moveTouchPaintGesture(gesture, 2, 20, 0)).toEqual({ gesture, action: "none" });
  });
});

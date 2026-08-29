import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventSeatingStats } from "@/features/events/event-seating-stats";

describe("EventSeatingStats", () => {
  it.each([
    [0, 0],
    [3, 7],
  ])("renders %i seated participants and %i occupied seats", (participants, seats) => {
    const markup = renderToStaticMarkup(
      createElement(EventSeatingStats, {
        seatedParticipantCount: participants,
        occupiedSeatCount: seats,
      }),
    );
    expect(markup).toContain(`已选座人数</dt><dd>${participants} 人`);
    expect(markup).toContain(`已占用座位</dt><dd>${seats} 个`);
  });
});

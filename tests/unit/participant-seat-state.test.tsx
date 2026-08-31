// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ParticipantSeatButton,
  ParticipantSeatLegend,
  type ParticipantSeatDto,
} from "@/features/seating/participant-seat-state";

afterEach(cleanup);

const seat: ParticipantSeatDto = {
  id: "seat-1",
  rowIndex: 0,
  columnIndex: 0,
  rowLabel: "A",
  columnLabel: "1",
  kind: "seat",
  selectable: true,
  golden: false,
};

describe("participant seat state", () => {
  it("renders the complete shared participant legend", () => {
    render(<ParticipantSeatLegend />);
    for (const label of ["可选", "黄金区", "我的选择", "他人已选", "不可选", "左右半场中线"])
      expect(screen.getByText(label)).toBeTruthy();
    expect(document.querySelector('[data-seat-state-icon="occupied"]')).toBeTruthy();
    expect(document.querySelector('[data-seat-state-icon="blocked"]')).toBeTruthy();
  });

  it("distinguishes occupied seats from blocked seats", () => {
    const onSelect = vi.fn();
    const view = render(
      <ParticipantSeatButton seat={seat} occupied available selected={false} onSelect={onSelect} />,
    );
    const occupied = screen.getByRole("button", { name: "A排1座：已被他人选择" });
    expect(occupied.classList.contains("occupied")).toBe(true);
    expect(occupied.querySelector('[data-seat-state-icon="occupied"]')).toBeTruthy();
    fireEvent.click(occupied);
    expect(onSelect).toHaveBeenCalledOnce();

    view.rerender(
      <ParticipantSeatButton seat={seat} occupied={false} available={false} selected={false} onSelect={onSelect} />,
    );
    const blocked = screen.getByRole("button", { name: "A排1座：不可选" });
    expect(blocked.classList.contains("blocked")).toBe(true);
    expect(blocked.querySelector('[data-seat-state-icon="blocked"]')).toBeTruthy();
    expect((blocked as HTMLButtonElement).disabled).toBe(true);
  });
});
